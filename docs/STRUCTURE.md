# 仓库目录

[返回项目首页](../README.md)

```text
OnlyWosoLovers/
├── README.md                 项目首页与文档入口
├── CONTRIBUTING.md           GitHub 贡献指南
├── data/                     正式图谱数据
│   └── 人物关系图谱-爱心图.json
├── docs/                     使用、开发和维护说明
│   ├── USAGE.md              使用指南
│   ├── DEVELOPMENT.md        开发说明
│   ├── DEPLOYMENT.md         部署与更新
│   ├── STRUCTURE.md          本目录说明
│   └── 项目计划.md           路线与验收安排
├── src/                      页面模板、样式与功能源码
├── tests/                    构建、规则与交互回归检查
├── .github/                  自动部署、PR 检查与贡献模板
├── build.mjs                 构建入口
├── package.json              开发命令与依赖声明
├── package-lock.json         锁定依赖版本
├── tsconfig.json             TypeScript 检查配置
├── index.html                自动生成、可离线打开的页面
└── dist/                     自动生成的部署产物，不提交 Git
```

## 修改放在哪里

- 更新人物、关系、头像或正式排布：修改 `data/人物关系图谱-爱心图.json`，不要用旧副本覆盖其他贡献。
- 修改功能和布局：修改 `src/`，脚本加载顺序由 `src/manifest.json` 声明。
- 增加回归检查：放入 `tests/`，并按需加入 `package.json` 的测试命令。
- 修改使用、开发和维护说明：放入 `docs/`，首页只保留简要介绍与链接。贡献指南保留在根目录，方便 GitHub 展示。
- 构建后根目录 `index.html` 随源码提交，以保留双击离线打开方式；不要直接手改生成的 HTML。

运行 `npm run check` 会从 `src/` 和 `data/` 构建并检查根目录及 `dist/` 两份页面；GitHub Pages 仍由现有工作流发布 `dist/`。构建命令、网站地址、人物 ID、坐标与浏览器存储标识不因本次目录整理改变。

原根目录的图谱 JSON 已移入 `data/`，项目计划已移入 `docs/`。旧书签或贡献说明中的文件路径需要改用新位置；无需重新导入或清除浏览器中保存的数据。
