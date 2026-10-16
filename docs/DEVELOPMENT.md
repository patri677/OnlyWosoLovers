# 开发说明

[返回项目首页](../README.md) · [贡献指南](../CONTRIBUTING.md)

## 项目状态

本项目长期采用纯静态网站方案，不计划开发应用后端、云端数据库、站内注册登录或多人实时编辑。浏览和本地编辑不需要站内账号；向 GitHub 提交 Issue 或 PR 则使用 GitHub 账号。

目前已完成本地编辑、文件备份、静态发布流程、按功能拆分源码，以及核心规则的 TypeScript 迁移。后续重点是手机/平板实机验收、约 100 个及更多节点的性能检查、资料质量和社区贡献维护。自动化逻辑检查已通过，但不代表所有设备均已实机验证。阶段目标、验收标准和运维安排见 [项目计划.md](项目计划.md)。

## 本地构建

需要 Node.js 22 或更高版本。首次开发或更新依赖后运行 `npm ci` 安装锁定的开发依赖。运行 `npm run build`（或 `node build.mjs`），会从 `src` 和 `data/人物关系图谱-爱心图.json` 校验并生成根目录的 `index.html` 与 `dist/index.html`。根目录页面保留原有本地存储标识，部署页面按正式数据版本生成标识。GitHub Actions 在 `main` 更新后安装锁定依赖，执行同一构建、检查并发布至 GitHub Pages。

运行 `npm run check` 可进行类型检查、构建并执行现有回归检查。`npm run typecheck` 单独检查 TypeScript；`npm test` 检查当前已经生成的页面。构建成品包含全部脚本、样式和图谱数据，可双击打开，不依赖开发服务器，也不需要安装 Node.js 或 TypeScript。

## 修改源码

发布前另运行 `npm run test:release`，在现有检查基础上执行 `tests/release.mjs` 的异常和安全边界专项。首次发现的 5 项问题已修复并回归通过，详见[发布验收](RELEASE-AUDIT.md)。普通 `npm run check` 通过不能代替该专项检查；Pages 与 PR 工作流也会执行该专项。

请修改 `src`，不要直接修改自动生成的 `index.html` 或 `dist/index.html`。修改后运行 `npm run check`，再打开生成页面。

| 文件 | 用途 |
| --- | --- |
| `src/index.template.html`、`src/styles.css` | 页面结构、基础样式 |
| `src/graph-domain.ts` | 人物/关系/筛选类型、共享数据校验、关系分类和组合匹配规则 |
| `src/core.js`、`src/avatars.js` | 图谱基础操作、存储、人物及头像编辑 |
| `src/data-transfer.js` | JSON 导入导出 |
| `src/view-export-layout.js` | 人物聚焦、HTML/图片导出、面板与关系标签 |
| `src/filters.js`、`src/view-state.js` | 筛选条件、关系分类和显示状态 |
| `src/legend-filters.js` | 右上角关系颜色图例、多选及下拉筛选同步 |
| `src/responsive.js` | 固定画布坐标下的适配、手势、菜单定位 |
| `src/manifest.json`、`src/bootstrap.js` | 功能加载顺序、统一启动 |

核心数据与筛选规则已迁移到严格检查的 TypeScript，界面和交互部分目前仍使用 JavaScript，共享页面状态，尚未迁移 React。`src/manifest.json` 同时声明 `.ts` 和 `.js` 的加载顺序；构建会先进行类型检查，再把 TypeScript 编译为普通 JavaScript 内嵌到 HTML。任何未纳入 `tsconfig.json` 的 TypeScript 入口都会阻止构建，避免漏检。

`graph-domain.ts` 以 `WosoGraph` 命名空间提供不依赖界面的规则；浏览器 JSON 导入和发布前的数据检查使用同一份规则。具体关系分类保留“已婚”“订婚”“现任？”“前任？”类别，同时支持大类筛选。旧版数组格式的关系筛选仍能恢复。页面会在全部功能加载后才首次绘图，避免初始化时引用尚未定义的函数。

回归检查覆盖单文件输出、正式数据与坐标完整性、JSON 往返与异常输入、关系分类、组合筛选和节点高亮，以及移动端适配计算和手势逻辑。界面布局和触屏手感仍需实机验证。


部署操作请见[部署与更新](DEPLOYMENT.md)。
