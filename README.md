# 题栈 · 刷题应用

一个离线优先的刷题应用：网页版与 Android 版共用同一套前端，题库和练习记录都保存在本机，不上传服务器。

- **网页版**：<https://baijiamingxa.github.io/tizhan/>
- **Android 版**：[下载 APK](https://github.com/baijiamingxa/tizhan/releases/latest)（Android 9 及以上）

## 功能

- 导入 Word 题库（`.doc` / `.docx`），自动识别题号、选项、参考答案与解析
- 题库与答案分开导入：先导入无答案题库，再单独导入答案文档
- AI 补全答案：用自己的 API Key 联网生成缺失答案（OpenAI 兼容接口）
- AI 讲题：点任意一题，让 AI 讲清为什么是这个答案，复用已保存的接口配置与 Key
- 导出题库：可导出「含答案」或「无答案」的 Word 文档
- 多题库管理：切换、删除自建题库，导入复习资料到知识点页面
- 练习台：按题型筛选、答题卡、上一题/下一题、练习小结
- 错题重练：独立错题队列，连续答对两次才移出错题本
- 背题模式：先看答案记忆，再翻转成自测
- 模拟考：按题型/知识点随机组卷、倒计时、交卷自动判分并逐题解析
- 学习统计：正确率趋势、最弱知识点、每天练题数量
- 题库内搜题：输入关键词直接跳转到题目
- 收藏夹、知识点速览，练习进度自动保存
- 应用内「检查更新」：读取 GitHub 仓库最新 Release，有新版时直接跳转下载

## 导入格式

题库文档（题号另起一行，选项用 `A、…`）：

```text
1、Java 中 int 类型占几个字节？
A、1 B、2 C、4 D、8
2、Java 程序入口方法名是 ______。
3、简述 Java 的跨平台原理。
```

答案文档（单独导入，支持逐条或区间）：

```text
1. C
2. main
3. 通过编译为字节码并由 JVM 解释执行。
1-5 ABCDA
```

答案写入规则：单选/判断转成字母，多选连写（如 `AC`），填空按空顺序用 `；` 分隔，简答与编程题保存参考答案。

## AI 补全答案

1. 选择题库后点击侧栏「AI 补全答案」
2. 填写接口地址（默认 `https://api.openai.com/v1`）和 **你自己的** API Key
3. 可先点「测试连接」确认地址与 Key 可用，点「获取模型」拉取接口的模型列表后从下拉框选择
4. 点击「联网生成」，只处理缺少答案的题目；生成的每道题都带详细解答，简答与编程题还会附评分要点
5. 配置可点「保存配置」单独保存；之后在题目卡片上点「AI 讲题」，会复用同一套接口、模型与 Key

每位用户在自己的设备上填写自己的 Key，Key 与接口配置只保存在本机浏览器，不会上传；可随时点「清除本机保存的 Key」。接口需兼容 OpenAI 的 `/chat/completions`；Android 端仅允许 https 接口。

## 数据存储

- 题库、答案、复习资料保存在浏览器 IndexedDB（`tizhan-word-library`）
- 练习进度、收藏、AI 配置保存在 localStorage
- 应用不内置题库，首次打开是空白状态，导入后即可使用

## 本地运行

网页版需要通过 http(s) 打开（`file://` 下 IndexedDB 不可用）：

```powershell
npx serve docs
```

## 构建 Android APK

需要 Windows、Node.js、JDK 和 Android SDK（build-tools 37.0.0、android-36）。

```powershell
cd android
./build.ps1
```

脚本会用 esbuild 打包 `docs` 下的前端资源，与 Java 壳一起生成并签名 `题栈-1.9.0.apk`。首次运行会生成签名密钥并保存在本机 `%LOCALAPPDATA%\Tizhan\Signing`。

## 目录结构

```text
docs/      网页版前端（GitHub Pages 根目录）
android/   Android WebView 壳、构建脚本与资源
apk/       已签名的安装包
```
