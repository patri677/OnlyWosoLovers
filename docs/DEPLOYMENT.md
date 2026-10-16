# 部署与更新

[返回项目首页](../README.md)

## 网站发布与更新

网站已通过 GitHub Pages 首次部署，地址为 <https://patri677.github.io/OnlyWosoLovers/>；不需要自购域名或使用阿里云服务器。

1. 维护者先获取远程最新修改，保留已有文档和资料，再修改源码或正式 JSON。
2. 运行 `npm run check`，核对数据、交互和生成的 `index.html`，提交后推送到 `main`。
3. 在 [Actions](https://github.com/patri677/OnlyWosoLovers/actions) 查看 `Deploy static site`。每次推送会自动构建、检查并发布 `dist`；通常无需手动发布。
4. 若需重试，在该流程的 **Run workflow** 中选择 `main`；成功后点击运行结果中的网站链接，并验证改动。失败时查看失败步骤，不要新增重复部署工作流。

推送成功不等于部署完成，应以对应提交的部署结果和线上页面为准。看到旧界面时先确认最新部署已成功，再刷新或用无痕窗口核对；手机上保存过的旧 HTML 文件不会随网站自动更新。不要为了刷新程序随意清除浏览器存储，以免丢失未导出的本地编辑；操作前请先导出 JSON。

## 首次启用

在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。仓库已包含 `.github/workflows/pages.yml`，无需另建 Static HTML 或 Jekyll 工作流。

## 发布与权限

网站访客在浏览器中所做的修改只影响自己的副本，不会直接写入仓库。新手可以[提交资料建议](https://github.com/patri677/OnlyWosoLovers/issues/new?template=data-suggestion.yml)，熟悉 GitHub 的贡献者可以 Fork 本仓库、修改 JSON 并创建 Pull Request。所有外部贡献都要由仓库管理员审核和合并；请先阅读[贡献指南](../CONTRIBUTING.md)。页面中的“提交贡献”按钮用于打开该指南，不会自动创建分支或提交 PR。

`main` 的维护目标是仅仓库所有者 `patri677` 可更新；贡献者通过 Fork 提交 PR，不需要主仓库写权限。实际限制由 GitHub 协作者权限和 Rulesets / 分支保护设置执行，不能仅靠文档保证。不要把账号密码、访问令牌等秘密放进项目文件。

仓库权限和分支保护由 GitHub 设置执行；不要将密码、令牌等秘密提交到公开仓库。只有明确要求推送时才推送，其余修改保留本地。
