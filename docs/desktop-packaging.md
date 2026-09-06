# AngelMark 桌面 EXE 打包说明

## 目标

将当前 React + Vite 原型封装为 Windows 10/11 可直接运行的独立 EXE，并同时提供：

- 正式发布版：面向分发，默认不保留 source map。
- 开发测试版：面向调试排查，保留 source map，便于定位问题。

当前已生成的产物路径：

- 正式版：`release/win-release/AngelMark-1.0.0-win-x64-release.exe`
- 调试版：`release/win-debug/AngelMark-Debug-1.0.0-win-x64.exe`

## 依赖工具安装

1. 安装 Node.js 22+（建议使用 LTS 版本，需自带 `npm`）。
2. 确认系统为 Windows 10 或更高版本。
3. 确认系统内置 `IExpress` 可用：

```powershell
where.exe iexpress
```

4. 安装项目依赖：

```powershell
npm.cmd install
```

5. 若 `node_modules/electron/dist` 尚未完整下载，可使用以下任一方式准备纯 Electron runtime：

```powershell
node .\node_modules\electron\install.js
```

若官方源下载不稳定，可手动下载镜像 ZIP 到 `release/.runtime-cache/`：

```powershell
Invoke-WebRequest `
  -Uri "https://npmmirror.com/mirrors/electron/v44.1.1/electron-v44.1.1-win32-x64.zip" `
  -OutFile ".\release\.runtime-cache\electron-v44.1.1-win32-x64.zip"
```

## 打包命令

```powershell
npm.cmd run dist:win:release
npm.cmd run dist:win:debug
npm.cmd run dist:win:all
```

### 命令说明

- `dist:win:release`
  - 构建生产前端资源
  - 去除 release sourcemap
  - 裁剪语言包，仅保留 `en-US` 与 `zh-CN`
  - 生成单文件正式版 EXE

- `dist:win:debug`
  - 构建带 sourcemap 的桌面调试资源
  - 生成开发测试版 EXE
  - 便于在桌面问题排查时结合日志与映射定位

- `dist:win:all`
  - 顺序执行 release 与 debug 两条链路

## 打包脚本参数与行为

主脚本：`scripts/package-desktop.mjs`

脚本入口参数：

- `release`
- `debug`

对应策略如下：

| 参数 | 构建脚本 | 输出目录 | 单文件产物 | sourcemap |
| --- | --- | --- | --- | --- |
| `release` | `build:web` | `release/win-release` | `AngelMark-1.0.0-win-x64-release.exe` | 不保留 |
| `debug` | `build:web:debug` | `release/win-debug` | `AngelMark-Debug-1.0.0-win-x64.exe` | 保留 |

脚本当前执行流程：

1. 运行 Vite 构建前端资源。
2. 优先使用纯 Electron runtime：
   - `node_modules/electron/dist`
   - 或 `release/.runtime-cache/electron-v44.1.1-win32-x64.zip`
   - 或临时目录中可用的 Electron ZIP 缓存
3. 组装桌面运行目录：
   - `dist/`
   - `electron/main.mjs`
   - `electron/preload.mjs`
   - `electron-log`
4. 压缩为 ZIP 载荷。
5. 使用 `IExpress` 生成单文件 EXE。

## 当前产物结构

正式版目录：

- `release/win-release/AngelMark-1.0.0-win-x64-release.exe`
- `release/win-release/AngelMarkPortable-win32-x64/`
- `release/win-release/stage/angelmark-release.zip`

调试版目录：

- `release/win-debug/AngelMark-Debug-1.0.0-win-x64.exe`
- `release/win-debug/AngelMark Debug-win32-x64/`
- `release/win-debug/stage/angelmark-debug.zip`

## 体积优化策略

当前已落地的优化：

- release 默认移除前端 sourcemap
- 仅保留 `zh-CN` 与 `en-US` 语言包
- 不使用 electron-builder 的完整安装器链路，改为 portable 单文件方案
- 只打入业务所需的 `dist + electron + electron-log`
- 正式版与调试版拆分，避免调试信息进入正式包

本次构建结果：

| 版本 | 单文件 EXE | ZIP 载荷 |
| --- | --- | --- |
| 正式版 | 约 139.01 MB | 约 139.83 MB |
| 调试版 | 约 152.40 MB | 约 153 MB 左右 |

## 基础安全处理

当前已做的基础安全措施：

- Electron 窗口启用 `contextIsolation: true`
- 关闭 `nodeIntegration`
- 开启 `sandbox: true`
- 使用单实例锁，避免重复实例冲突
- 外部链接统一交给系统浏览器打开
- release 默认隐藏菜单栏，避免误操作
- release 不带 sourcemap，减少暴露内部源码细节
- 不申请管理员权限，单文件 EXE 解压到当前用户 `LocalAppData`

建议上线前补齐：

1. 使用企业代码签名证书对正式版 EXE 签名。
2. 固定发布版本号与文件哈希，建立白名单提交流程。
3. 在目标杀软环境中补做一次误报扫描与申诉。

说明：未签名的自解压 EXE 仍有概率触发 SmartScreen 或杀软审查，这是 Windows 分发侧常见现象，代码签名仍是最有效的后续措施。

## 功能验证测试方案

### 自动化验证

```powershell
npm.cmd run test
npm.cmd run build:web
npm.cmd run dist:win:all
```

### 已完成的桌面烟测

- release unpacked EXE 启动通过
- debug unpacked EXE 启动通过
- release 单文件 EXE 自解压到 `%LOCALAPPDATA%\AngelMark\runtime\release` 通过
- debug 单文件 EXE 自解压到 `%LOCALAPPDATA%\AngelMark\runtime\debug` 通过

### 建议的人工回归清单

1. 双击正式版 EXE，确认首页正常加载。
2. 新建好友档案，确认卡片即时出现。
3. 新增标签并调整分值，确认详情页与图表同步刷新。
4. 新增一条互动事件，确认时间轴生成且记录前后分值。
5. 切换浅色/深色主题，确认样式完整。
6. 执行图表缩放、时间筛选、分值筛选。
7. 导出 PNG/JPG，确认文件可打开且分辨率满足留存需求。
8. 关闭并重新打开程序，确认本地数据仍在。

## 桌面日志与排查

- 调试版默认更适合问题排查。
- 桌面日志由 `electron-log` 写入用户目录。
- release 与 debug 的单文件 EXE 会分别解压到：
  - `%LOCALAPPDATA%\AngelMark\runtime\release`
  - `%LOCALAPPDATA%\AngelMark\runtime\debug`

若需要排查桌面问题，优先复现于 debug 版，再结合日志与 source map 分析。

## 已知限制

- 当前数据仍基于本地存储，不含账号同步能力。
- 当前未做代码签名，因此对外分发前仍建议补签名与杀软白名单验证。
- 该桌面包方案面向 Windows 10/11，未覆盖 macOS / Linux 分发。
