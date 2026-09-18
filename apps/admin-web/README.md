# 智能家居后台 Web · Phase 2-1

独立 Next.js App Router 项目，中文界面，TypeScript strict。要求 Node.js 24+ 与 npm。

在本目录执行：

```text
npm install
npm run dev
```

打开 http://localhost:3000，自动进入 `/login`；点击“进入后台预览”进入 `/dashboard`。四个导航通往 `/dashboard`、`/customers`、`/products`、`/projects`，PC 和 iPad 使用侧栏，窄屏通过导航菜单按钮访问。

当前只是前端骨架：没有真实登录或路由授权保护；不收集/提交密码，不保存 token。用户和退出按钮为明确的占位。列表为空，尚未接 API，页面不提供数据写入。后台可直接访问，不能作为已认证管理端部署使用。

可复制 `.env.example` 为 `.env.local`，其中 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` 为后续 API 集成预留，本次尚未使用。`NEXT_PUBLIC_` 变量会公开到浏览器，不得存放密钥。

验证：

```text
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

`npm test` / `npm run test:e2e` 均使用真实 Next.js 服务和 Chromium，不依赖后端。测试涵盖入口、中文页面、导航高亮、空状态、顶部占位、iPad 无横向溢出及窄屏键盘菜单。默认自动启动 dev 服务；生产构建验证在 Bash 使用 `PLAYWRIGHT_PRODUCTION=1 npm test`，PowerShell 使用 `$env:PLAYWRIGHT_PRODUCTION='1'; npm test`。关闭其他 3000 端口服务后运行，以确保测的是当前构建。

Windows 可使用已安装 Edge：`$env:PLAYWRIGHT_CHANNEL='msedge'; npm test`；CI 默认使用 Playwright Chromium。

生产服务：

```text
npm run build
npm run start
```

`app/` 管理路由，`components/` 为共享布局与空状态，`lib/` 保存导航配置，`types/` 定义导航类型，`tests/` 为浏览器测试。npm lockfile 用于 CI 的 `npm ci`。没有 SceneModel 持久化、Unity、CAD、VR 实现。
