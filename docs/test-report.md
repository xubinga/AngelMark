# AngelMark 测试报告

## 测试范围
- 好友档案创建与展示
- 标签新增与数值展示
- 事件记录前后分值快照逻辑
- 标签时间轴生成逻辑
- 首页全局搜索联想与页面跳转
- 首页折线图多维筛选与聚合逻辑
- 项目生产构建

## 测试方式
- 自动化单元/组件测试：Vitest + Testing Library
- 构建验证：Vite 生产构建
- 人工验证点：响应式布局、图表交互、主题切换、图表导出

## 测试结果

| 模块 | 用例 | 结果 |
| --- | --- | --- |
| Affinity Utils | 分值边界限制 | 通过 |
| Affinity Utils | 事件自动记录前后分值 | 通过 |
| Affinity Utils | 标签时间轴生成 | 通过 |
| Charting Utils | 单用户 / 多用户 / 标签聚合 / 事件窗口序列 | 通过 |
| App 组件 | 默认首页渲染 | 通过 |
| App 组件 | 首页全局搜索联想跳转 | 通过 |
| App 组件 | 首页图表筛选模式切换 | 通过 |
| App 组件 | 创建好友档案 | 通过 |
| App 组件 | 新增标签 | 通过 |
| App 组件 | 创建互动事件 | 通过 |
| App 组件 | 系统设置撤销重做 | 通过 |
| 构建 | `npm run build` | 通过 |

## 已验证命令

```bash
npm run test
npm run build:web
```

## 人工验收建议
1. 在桌面端验证深色 / 浅色切换是否符合预期。
2. 在详情页测试滚轮缩放、工具栏缩放、恢复视图。
3. 在首页切换单用户、标签聚合、事件窗口和多用户模式，确认图表切换顺滑。
4. 使用右上角搜索框测试好友、标签、事件的联想与跳转。
5. 分别导出 PNG 与 JPG，确认文件分辨率满足 1080P 留存需求。
6. 在移动端宽度下检查卡片、表单、搜索栏和时间轴是否正常换行。

## 当前已知事项
- 图表使用 ECharts，打包体积较大，因此构建时会出现 chunk 大小提示，但不影响运行与功能验收。
- 当前原型使用本地存储，不包含账号登录与跨设备同步。

## 桌面 EXE 打包验证

### 已执行命令

```bash
npm.cmd run dist:win:all
```

### 桌面产物结果

| 版本 | 产物路径 | 结果 |
| --- | --- | --- |
| Release | `release/win-release/AngelMark-1.0.0-win-x64-release.exe` | 通过 |
| Debug | `release/win-debug/AngelMark-Debug-1.0.0-win-x64.exe` | 通过 |

### 桌面烟测结果

| 项目 | 验证内容 | 结果 |
| --- | --- | --- |
| Unpacked Release | `AngelMark.exe` 可启动 | 通过 |
| Unpacked Debug | `AngelMark Debug.exe` 可启动 | 通过 |
| Single-file Release | 自解压到 `%LOCALAPPDATA%\\AngelMark\\runtime\\release` | 通过 |
| Single-file Debug | 自解压到 `%LOCALAPPDATA%\\AngelMark\\runtime\\debug` | 通过 |

### 桌面验证结论

- 当前已完成正式版与调试版单文件 EXE 生成。
- 正式版与调试版均已通过基础启动与自解压烟测。
- 更完整的业务功能回归项、参数说明与安全建议见 `docs/desktop-packaging.md`。
