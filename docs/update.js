const UpdateCheck = (function(){
'use strict';
const REPO='baijiamingxa/tizhan';
const VERSION='1.10.0';
const el=id=>document.getElementById(id);
let checking=false,downloadUrl='';
function parse(version){
 return String(version||'').replace(/^v/i,'').split(/[.\-+]/,3).map(n=>parseInt(n,10)||0);
}
function compare(a,b){
 const left=parse(a),right=parse(b);
 for(let i=0;i<3;i++){
  const x=left[i]||0,y=right[i]||0;
  if(x!==y)return x>y?1:-1;
 }
 return 0;
}
function openExternal(url){
 if(!url)return;
 if(window.TizhanOpen&&typeof window.TizhanOpen.open==='function')window.TizhanOpen.open(url);
 else window.open(url,'_blank','noopener');
}
function close(){
 el('updateDialog').hidden=true;
 el('checkUpdate').focus();
}
function render(found,release,latest){
 el('updateStatus').textContent=found
  ?`发现新版本 ${latest}（当前 ${VERSION}）。`
  :`已是最新版本 ${VERSION}。`;
 const notes=el('updateNotes');
 const body=found&&release&&release.body?String(release.body).trim():'';
 notes.textContent=body;notes.hidden=!body;
 const asset=found&&release&&Array.isArray(release.assets)
  ?release.assets.find(item=>/\.apk$/i.test(item.name||'')||/android/i.test(item.content_type||''))
  :null;
 downloadUrl=found?((asset&&(asset.browser_download_url||asset.download_url))||(release&&release.html_url)||`https://github.com/${REPO}/releases`):'';
 el('downloadUpdate').hidden=!found;
 el('downloadUpdate').textContent=asset?'下载新版 APK':'打开发布页';
}
function check(){
 if(checking)return;
 checking=true;
 el('updateDialog').hidden=false;
 el('updateStatus').textContent='正在检查…';
 el('updateNotes').hidden=true;el('downloadUpdate').hidden=true;
 el('closeUpdate').focus();
 const endpoint=`https://api.github.com/repos/${REPO}/releases/latest`;
 let request;
 try{
  request=fetch(endpoint,{headers:{accept:'application/vnd.github+json'},cache:'no-store'});
 }catch{request=Promise.reject(Error('无法访问网络'))}
 request.then(response=>{
  if(response.status===404)throw Error('仓库还没有发布版本');
  if(response.status===403)throw Error('请求过于频繁，请稍后再试');
  if(!response.ok)throw Error('接口返回 HTTP '+response.status);
  return response.json();
 }).then(release=>{
  const latest=String(release.tag_name||release.name||'').replace(/^v/i,'');
  if(!latest)throw Error('没有识别到版本号');
  render(compare(latest,VERSION)>0,release,latest);
 }).catch(error=>{
  el('updateStatus').textContent=`检查失败：${error.message||'网络错误'}。请确认网络可用后重试。`;
  el('updateNotes').hidden=true;el('downloadUpdate').hidden=true;
 }).finally(()=>{checking=false});
}
function init(){
 el('checkUpdate').onclick=check;
 el('closeUpdate').onclick=close;
 el('downloadUpdate').onclick=()=>{if(downloadUrl)openExternal(downloadUrl)};
 el('updateDialog').onclick=e=>{if(e.target===el('updateDialog'))close()};
 document.addEventListener('keydown',e=>{
  if(el('updateDialog').hidden)return;
  if(e.key==='Escape'){close();return}
  if(e.key!=='Tab')return;
  const nodes=Array.from(el('updateDialog').querySelectorAll('button:not(:disabled)')).filter(n=>n.offsetParent!==null);
  if(e.shiftKey&&document.activeElement===nodes[0]){nodes[nodes.length-1]?.focus();e.preventDefault()}
  if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){nodes[0]?.focus();e.preventDefault()}
 });
}
return {init,VERSION};
})();
UpdateCheck.init();
