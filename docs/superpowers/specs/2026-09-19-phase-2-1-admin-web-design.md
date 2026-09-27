# Phase 2-1 后台 Web 骨架设计

用户已批准此设计；只实现独立 `apps/admin-web`，不改变业务后端或 SceneModel 数据库。

## 页面与交互

Next.js App Router + TypeScript strict，所有界面中文。`/` 跳转 `/login`；登录页明确标注当前是界面预览，不提交密码、不模拟身份认证，通过“进入后台预览”链接进入 `/dashboard`。后台地址可直接访问，无授权保护声明。

共享后台布局含仪表盘、客户管理、商品管理、设计项目四个导航，突出当前页面。顶部为预览用户区域和禁用的退出占位按钮；提供可用的返回登录页链接。仪表盘说明预览范围，三种列表展示真实空状态，不显示虚构客户、商品、项目或统计。

## 视觉与组件

白色卡片、柔和浅灰背景、深绿色强调，清晰标题与宽松间距。PC 使用左侧菜单；iPad 768/820/1024px 保持可用导航与无横向溢出，较窄屏幕折叠为菜单按钮控制抽屉。键盘可访问、导航含 aria-current，菜单支持 Esc 关闭和焦点返回。

`app/` 定义路由，`components/` 提供布局/导航/空状态，`lib/` 保存导航配置，`types/` 定义导航类型。CSS 使用原生样式，不额外引入 UI 框架、字体网络请求或图片依赖。

## 配置与验证

`.env.example` 包含 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`；本次无 API 调用。npm lock 固定安装结果；提供 dev/start/lint/typecheck/build/test/test:e2e。Playwright 对真实页面测试根跳转、预览入口、导航、空状态、占位与 iPad 布局。按 TDD 先验证失败，再实现；运行 ESLint、tsc、生产构建及浏览器测试。增加独立前端 CI，不改变后端工作流。

完成后推送 `codex/phase-2-admin-scene`，不创建 PR、不进行后续阶段。
