param(
    [string]$Sdk = ${env:ANDROID_HOME},
    [string]$Jdk = ${env:JAVA_HOME},
    [string]$WebAssets = (Join-Path $PSScriptRoot '../docs')
)
$ErrorActionPreference = 'Stop'
if (!$Sdk) { $Sdk = Join-Path ${env:ProgramFiles(x86)} 'Android/android-sdk' }
if (!$Jdk) { $Jdk = Split-Path -Parent (Split-Path -Parent (Get-Command keytool.exe).Source) }
$buildTools = Join-Path $Sdk 'build-tools/37.0.0'
$platform = Join-Path $Sdk 'platforms/android-36/android.jar'
$java = Join-Path $Jdk 'bin/java.exe'
$signer = Join-Path $buildTools 'lib/apksigner.jar'
function Run([string]$exe, [string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "Build command failed ($LASTEXITCODE): $exe" }
}

$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$stage = Join-Path $tempRoot ('tizhan-apk-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
Push-Location $PSScriptRoot
try {
    foreach ($part in 'classes','dex','assets') { New-Item -ItemType Directory -Path (Join-Path $stage $part) | Out-Null }
    $assets = Join-Path $stage 'assets'
    Copy-Item -LiteralPath (Join-Path $WebAssets 'style.css'),(Join-Path $WebAssets 'word-reader.js') -Destination $assets
    $html = [IO.File]::ReadAllText((Resolve-Path (Join-Path $WebAssets 'index.html')))
    [IO.File]::WriteAllText((Join-Path $assets 'index.html'),$html.Replace('练习记录保存在当前浏览器','练习记录保存在本机'))
    $script = [IO.File]::ReadAllText((Resolve-Path (Join-Path $WebAssets 'app.js')))
    $script = $script.Replace('Object.hasOwn(', 'Object.prototype.hasOwnProperty.call(')
    [IO.File]::WriteAllText((Join-Path $stage 'web.js'),$script)
    if (!(Test-Path 'node_modules/.bin/esbuild.cmd')) { Run 'npm.cmd' @('ci','--no-audit','--no-fund') }
    Run 'node' @('node_modules/esbuild/bin/esbuild',(Join-Path $stage 'web.js'),'--target=chrome74',("--outfile=" + (Join-Path $assets 'app.js')))

    foreach ($module in 'word-import.js','bank-export.js','update.js','library.js') {
        Run 'node' @('node_modules/esbuild/bin/esbuild',(Join-Path $WebAssets $module),'--target=chrome74',("--outfile=" + (Join-Path $assets $module)))
    }

    $resources = Join-Path $stage 'resources.zip'
    $unsigned = Join-Path $stage 'unsigned.apk'
    $aligned = Join-Path $stage 'aligned.apk'
    $signed = Join-Path $stage 'signed.apk'
    $aapt = Join-Path $buildTools 'aapt2.exe'
    Run $aapt @('compile','--dir','res','-o',$resources)
    Run $aapt @('link','--manifest','AndroidManifest.xml','-I',$platform,'-A',$assets,'-o',$unsigned,$resources)
    Run (Join-Path $Jdk 'bin/javac.exe') @('--release','8','-encoding','UTF-8','-classpath',$platform,'-d',(Join-Path $stage 'classes'),'src/cn/tizhan/javareview/MainActivity.java')
    $classesJar = Join-Path $stage 'classes.jar'
    Run (Join-Path $Jdk 'bin/jar.exe') @('cf',$classesJar,'-C',(Join-Path $stage 'classes'),'.')
    Run $java @('-cp',(Join-Path $buildTools 'lib/d8.jar'),'com.android.tools.r8.D8','--release','--lib',$platform,'--min-api','29','--output',(Join-Path $stage 'dex'),$classesJar)
    Run (Join-Path $Jdk 'bin/jar.exe') @('uf',$unsigned,'-C',(Join-Path $stage 'dex'),'classes.dex')
    Run (Join-Path $buildTools 'zipalign.exe') @('-f','4',$unsigned,$aligned)

    $keyDir = Join-Path $env:LOCALAPPDATA 'Tizhan/Signing'
    [IO.Directory]::CreateDirectory($keyDir) | Out-Null
    $store = Join-Path $keyDir 'release.p12'
    $secret = Join-Path $keyDir 'password.dpapi'
    if (!(Test-Path -LiteralPath $store) -and !(Test-Path -LiteralPath $secret)) {
        $random = New-Object byte[] 36
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($random) } finally { $rng.Dispose() }
        $env:TIZHAN_SIGN_PASSWORD = [Convert]::ToBase64String($random)
        $secure = ConvertTo-SecureString $env:TIZHAN_SIGN_PASSWORD -AsPlainText -Force
        $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $secret -Encoding ascii
        Run (Join-Path $Jdk 'bin/keytool.exe') @('-genkeypair','-alias','tizhan','-keystore',$store,'-storetype','PKCS12','-storepass:env','TIZHAN_SIGN_PASSWORD','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Tizhan Android')
    } else {
        if (!(Test-Path -LiteralPath $store) -or !(Test-Path -LiteralPath $secret)) { throw "Incomplete signing identity in $keyDir" }
        $secure = (Get-Content -Raw -LiteralPath $secret).Trim() | ConvertTo-SecureString
        $env:TIZHAN_SIGN_PASSWORD = [Net.NetworkCredential]::new('', $secure).Password
    }
    Run $java @('-jar',$signer,'sign','--ks',$store,'--ks-key-alias','tizhan','--ks-pass','env:TIZHAN_SIGN_PASSWORD','--v4-signing-enabled','false','--out',$signed,$aligned)
    Run $java @('-jar',$signer,'verify','--verbose',$signed)
    Run (Join-Path $buildTools 'zipalign.exe') @('-c','4',$signed)
    $output = Join-Path $PSScriptRoot '题栈-1.6.0.apk'
    Copy-Item -LiteralPath $signed -Destination $output
    Write-Output $output
} finally {
    Remove-Item Env:TIZHAN_SIGN_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
    $target = (Resolve-Path -LiteralPath $stage).Path
    if ([IO.Path]::GetDirectoryName($target) -eq $tempRoot.TrimEnd('\') -and [IO.Path]::GetFileName($target) -match '^tizhan-apk-[a-f0-9]{32}$') {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}
