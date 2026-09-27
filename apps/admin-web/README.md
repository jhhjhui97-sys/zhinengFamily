# 智能家居后台 Web · Phase 2-6

Next.js App Router、TypeScript strict、中文门店后台。要求 Node.js 24+ 与 npm。

在 `apps/admin-web` 创建 `.env.local`，配置服务端使用的 `API_BASE_URL=http://localhost:8000`，然后运行 `npm install`、`npm run dev`，打开 http://localhost:3000。先启动 Phase 1 FastAPI 和 PostgreSQL，并按仓库根 README 初始化真实 Merchant/User。登录表单需要该商家的 UUID、邮箱和密码。

浏览器只向同源 `/api/auth/login` 发送凭据。Next.js BFF 向 FastAPI `/auth/login` 请求 JWT，将它写入 `HttpOnly`、`SameSite=Strict`、`Path=/` Cookie；生产模式启用 `Secure`，Cookie `maxAge` 使用 FastAPI 返回的 `expires_in`。浏览器 JavaScript 无法读取 JWT，密码与 token 均不写入 localStorage 或 sessionStorage。受保护页面每次服务端渲染通过 `/auth/me` 校验 Cookie 对应的 JWT；上游 401 清除 Cookie 并转至登录页。退出经同源 POST 清除 Cookie。POST 路由校验 Origin。统一服务端 API Client 位于 `lib/api`，集中处理服务端 API 地址、Bearer、JSON、8 秒超时和中文错误。保留旧 `NEXT_PUBLIC_API_BASE_URL` 作为迁移期兼容回退；部署优先配置不暴露于浏览器的 `API_BASE_URL`，不在公共变量中存放密钥。

后台 `/dashboard`、`/customers`、`/products`、`/projects` 要求登录。顶部显示 `/auth/me` 返回的邮箱及角色。客户、商品与设计项目管理已提供真实列表、分页、新建、详情和编辑（现有 API 不提供删除），所有请求继续经过 BFF。商品支持搜索、任意分类筛选与安全 metadata JSON 校验。项目支持客户搜索选择（包括第一页之外的客户）、客户详情预选、中文状态；创建时后端默认当前销售员，编辑保留归属。客户搜索的 401 沿用 BFF 清除 Cookie 并回到登录页；403、服务和网络故障显示中文提示及重试，旧请求不会覆盖新查询。

项目详情已接通 SceneModel 当前状态和版本历史。可载入符合协议的两室一厅示例、编辑 JSON、保存新版本、查看只读快照及恢复历史；恢复会创建新版本。页面显示房间、墙体、门、窗、`furniture_instances` 数量和保存时间。409 会保留未保存内容，并要求先读取新版本；3D 入口仍禁用。

验收证据分开记录：本地 Windows/Edge Playwright 57 passed，lint/typecheck/build 通过；浏览器测试使用模拟上游 FastAPI，故障场景使用网络拦截，不等同于真实后端联调。先前已完成真实 FastAPI/PostgreSQL 登录、创建关联客户项目、编辑并刷新验证持久化；本轮搜索故障修复未重复真实数据库联调。已核实 CI 基线 SHA `63c83e00c79cce509ebae4f9004a421ce59a3559`：[前端 49 passed](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35691273046)、[后端 299 passed、2 warnings](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35691273050)。修复 SHA `0f485f965d6d142577d44363217c88ba1ae8f092` 的 [前端 CI 57 passed](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35713156751)、[后端 CI 299 passed、2 warnings](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35713156963) 已分别核实成功。详见 [Phase 2-5 验证记录](../../docs/superpowers/plans/2026-09-22-phase-2-5-projects.md)。

Phase 2-6 本地验证：Windows/Edge Playwright **69 passed**，使用模拟上游 FastAPI；lint、TypeScript strict typecheck 和生产 build 通过。后端真实 PostgreSQL pytest 为 **325 passed、3 skipped、2 warnings**，3 个 skip 是 Windows 符号链接权限用例；Ruff 和生成契约检查通过。另已用真实 PostgreSQL、FastAPI、Next.js BFF 和浏览器完成客户→项目→保存 v1→修改保存 v2→恢复 v1 生成 v3→刷新持久化验收，并确认 v1/v2/v3 均保留。实现 SHA `791b6a16b9e4f413e47aad142ccf751cf12c07bc` 的 [Admin Web Actions](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35816317745) 已以 69 passed 通过，[Backend Actions](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35816317748) 已以 328 passed、2 warnings 通过，且包含迁移、契约和 Docker build。

运行 `npm test`、`npm run lint`、`npm run typecheck`、`npm run build` 验证。Playwright 启动本地模拟 FastAPI 和独立 Next.js 服务，不使用真实密码；Windows 可设置 `$env:PLAYWRIGHT_CHANNEL='msedge'` 使用已安装 Edge。真实后端联调需另行启动 FastAPI/PostgreSQL，模拟测试不能替代联调。不要在 `.env.local` 或测试里提交真实账号、token、密钥。
