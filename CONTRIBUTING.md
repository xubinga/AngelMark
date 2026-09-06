# Contributing

欢迎继续完善 AngelMark。为了让项目在 GitHub 上更容易协作，提交前请先阅读本说明。

## 开发环境

- Node.js 20+
- npm 10+
- Windows 10/11 推荐用于桌面打包验证

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

## 提交前检查

请至少完成以下检查：

```bash
npm run test
npm run build:web
```

若改动涉及桌面打包链路，再执行：

```bash
npm run dist:win:all
```

## 代码约定

- 使用 TypeScript 和 React 函数组件。
- 保持好感度分值范围严格在 `-100` 到 `100` 之间。
- 复杂功能尽量抽到 `src/utils/` 做纯函数，方便测试。
- 页面层负责状态管理和交互，数据计算逻辑尽量不要直接堆在 JSX 中。
- 样式统一维护在 `src/App.css` 和 `src/index.css` 中。

## UI / UX 约束

- 顶部标题栏为固定框架层，左导航 + 右内容区为主信息架构。
- 专项功能页保持在 3 级导航深度以内。
- 遮罩或重点卡片应保持良好对比度和可读性。
- 右侧内容区的页面切换动画时长保持 `300ms`。

## 测试建议

新增功能时，优先补两类测试：
- `src/utils/*.test.ts`：验证纯业务逻辑
- `src/App.test.tsx`：验证关键用户路径和页面跳转

涉及以下能力时，请优先补覆盖：
- 搜索联想与跳转
- 图表筛选与时间窗口
- 数据导入导出
- 撤销 / 重做

## 文档要求

若改动影响用户操作流程，请同步更新以下文档中的至少一个：
- `README.md`
- `docs/test-report.md`
- `docs/xlsx-import-template.md`
- `docs/desktop-packaging.md`
- `CHANGELOG.md`

## 不建议提交的内容

以下目录或文件不应提交到仓库：
- `node_modules/`
- `dist/`
- `release/`
- 本地日志与临时文件

对应忽略规则已在 `.gitignore` 中配置。
