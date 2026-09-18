# Phase 2-1 执行与验证记录

## 起点与范围

- PR #1 的最新提交 `776038f7` CI success，用户明确授权后以 merge 方式合并；main 合并提交 `a6d8ec0ba681312008a2b49e0d4297672e066f41`。
- Git 命令行反复连接重置，通过 GitHub API 取得原始签名对象，严格 SHA 校验后导入；对象与远端 main 完全一致。新分支 `codex/phase-2-admin-scene` 从该合并提交创建。
- 用户已批准设计；当前目录继续开发，不另建工作树。
- 仅新增后台前端、前端工作流、忽略规则及文档。与 main 对比，apps/api、packages、迁移和原后端工作流没有差异。

## TDD 与复审

- RED：真实 Next.js 服务 + Edge；入口测试因根地址未跳转 login 失败。
- GREEN：实现登录预览入口后 1 passed；lint/typecheck 通过，提交 `f31aaa7`。
- RED：布局/列表/iPad/菜单 8 项浏览器测试全部因功能缺失失败。
- GREEN：实现共享布局、导航高亮、三个空状态后完整 9 passed，开发模式 10.5 秒；提交 `37f81c9`。
- 独立只读复审无 Critical/Important；改进空状态文字对比度，补菜单导航和 aria-expanded/焦点断言后完整 9 passed（生产模式 5.1 秒）。
- 检查实际 PC 1440px 与 iPad 820px 截图；另有 768/1024px 无溢出断言，390px 原生模态菜单/Esc/导航/焦点回归。

## 最终本地结果

| 检查 | 结果 |
| --- | --- |
| npm install | 成功，347 个依赖，audit 0 vulnerabilities |
| npm run dev | 成功；浏览器真实访问根地址、登录、后台页面 |
| npm run lint | 退出 0，零 lint 警告 |
| npm run typecheck | next typegen + strict tsc --noEmit，退出 0 |
| npm run build | Next.js 16.3.5 Turbopack 退出 0，五个页面均生成 |
| npm test | 开发模式 9 passed |
| 生产模式 npm test | 复审调整后 9 passed，5.1 秒，无跳过 |
| git diff --check | 通过 |

## 环境说明与限制

- Node 24.19.0；本机只有 Node，官方 npm CLI 下载到忽略的 `.local`；仓库不依赖这份工具，用户正常 npm 即可运行。
- TypeScript 6.0.3 在当前 ESLint 插件支持范围；最新 TS7 超出 peer 范围，未使用或强行忽略冲突。
- ESLint 9.39.5 安装时提示已停止支持；当前 eslint-plugin-react peer 范围限制为 ESLint 9。lint 实际通过，npm audit 无漏洞，未来应随 Next.js lint 插件兼容升级。
- npm 12 默认阻止 unrs-resolver 的 postinstall；平台原生依赖已正常安装，lint/typecheck/build 均通过，未放宽安装脚本权限。
- 浏览器运行保留工具环境的 NO_COLOR/FORCE_COLOR 警告，不是页面或业务错误。
- 登录是明确预览，不采集密码，不发 API 请求，不保存 token；后台没有真实授权保护。退出为禁用占位，列表无数据。
- 本机浏览器使用 Edge Chromium；iPad 为宽度验证，未使用实体 iPad/Safari。Linux Chromium 由独立前端 CI 验证。
- 不创建 Phase 2 PR，不开发后续功能。
- Next.js 的 next-env.d.ts 在 dev/build 时生成不同路径，作为生成文件忽略并保留本地副本；next typegen/dev/build 在干净环境自动生成，不手动维护。

## 交付

- 模块提交：`707bb49`（设计/计划）、`f31aaa7`（工具链/登录入口）、`37f81c9`（布局/列表）、`6e13bfc`（复审改进）、`616e278`（CI/文档）。
- 已推送 `codex/phase-2-admin-scene`，未创建 PR；本地开发服务可在 http://localhost:3000 查看。
