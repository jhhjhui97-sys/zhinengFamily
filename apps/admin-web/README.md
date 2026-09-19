# 智能家居后台 Web · Phase 2-2

Next.js App Router、TypeScript strict、中文门店后台。要求 Node.js 24+ 与 npm。

在 `apps/admin-web` 创建 `.env.local`，配置服务端使用的 `API_BASE_URL=http://localhost:8000`，然后运行 `npm install`、`npm run dev`，打开 http://localhost:3000。先启动 Phase 1 FastAPI 和 PostgreSQL，并按仓库根 README 初始化真实 Merchant/User。登录表单需要该商家的 UUID、邮箱和密码。

浏览器只向同源 `/api/auth/login` 发送凭据。Next.js BFF 向 FastAPI `/auth/login` 请求 JWT，将它写入 `HttpOnly`、`SameSite=Strict`、`Path=/` Cookie；生产模式启用 `Secure`，Cookie `maxAge` 使用 FastAPI 返回的 `expires_in`。浏览器 JavaScript 无法读取 JWT，密码与 token 均不写入 localStorage 或 sessionStorage。受保护页面每次服务端渲染通过 `/auth/me` 校验 Cookie 对应的 JWT；上游 401 清除 Cookie 并转至登录页。退出经同源 POST 清除 Cookie。POST 路由校验 Origin。统一服务端 API Client 位于 `lib/api`，集中处理服务端 API 地址、Bearer、JSON、8 秒超时和中文错误。保留旧 `NEXT_PUBLIC_API_BASE_URL` 作为迁移期兼容回退；部署优先配置不暴露于浏览器的 `API_BASE_URL`，不在公共变量中存放密钥。

后台 `/dashboard`、`/customers`、`/products`、`/projects` 要求登录。顶部显示 `/auth/me` 返回的邮箱及角色。客户、商品、设计项目仍为静态空状态，本期没有 CRUD 或 SceneModel 持久化。登录页遇网络故障会给出中文服务不可用提示。

运行 `npm test`、`npm run lint`、`npm run typecheck`、`npm run build` 验证。Playwright 启动本地模拟 FastAPI 和独立 Next.js 服务，不使用真实密码；Windows 可设置 `$env:PLAYWRIGHT_CHANNEL='msedge'` 使用已安装 Edge。真实后端联调需另行启动 FastAPI/PostgreSQL，模拟测试不能替代联调。不要在 `.env.local` 或测试里提交真实账号、token、密钥。
