# Phase 2-1 Admin Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 建立可运行的中文 Next.js 后台前端骨架。

**Architecture:** 独立 npm 项目；App Router 用后台 route group 共享布局。预览路由与真实认证明确区分，不接 API。

**Tech Stack:** Next.js、React、TypeScript strict、ESLint、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-19-phase-2-1-admin-web-design.md`

## Global Constraints

- 仅 `apps/admin-web`、前端 CI、忽略规则和文档；不修改业务后端。
- 分支 `codex/phase-2-admin-scene`，不创建 PR。
- 中文、明亮、适合 PC/iPad；不得伪装已接通 API 或认证。

## Task 1: 工具链与登录入口

Files: package.json/package-lock.json、tsconfig.json、eslint.config.mjs、playwright.config.ts、app/layout.tsx、app/page.tsx、app/login/page.tsx、tests/login.spec.ts。

- [x] 建立 npm 配置，安装锁定依赖；先写浏览器测试：`await page.goto('/'); await expect(page).toHaveURL(/login/); await page.getByRole('link',{name:'进入后台预览'}).click(); await expect(page).toHaveURL(/dashboard/);`。
- [x] 运行 `npm test`，确认页面缺失导致失败。
- [x] 最小实现根跳转、中文登录预览页和仪表盘入口，明确无真实认证。
- [x] 运行登录测试、lint、typecheck，提交工具链与入口。

## Task 2: 布局、列表和 iPad

Files: app/(admin)/layout.tsx、dashboard/customers/products/projects/page.tsx、components/admin-shell.tsx/navigation.tsx/empty-state.tsx、lib/navigation.ts、types/navigation.ts、app/globals.css、tests/admin.spec.ts。

- [x] 写真实页面测试：点击“客户管理”后期望 URL `/customers`、导航 aria-current=page、空状态“暂无客户”；商品和项目各有对应空状态。
- [x] 写 iPad 测试：`await page.setViewportSize({width:820,height:1180}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);`；小屏菜单打开关闭、Esc 和焦点返回。
- [x] 运行失败测试，确认布局、导航和空状态尚缺失。
- [x] 实现共享布局、导航高亮、顶部占位、响应式样式与三个列表空状态。
- [x] 运行浏览器回归，提交布局与页面。

## Task 3: 交付与验证

Files: apps/admin-web/README.md、.env.example、.github/workflows/admin-web.yml、.gitignore、docs/superpowers/plans/2026-09-19-phase-2-1-progress.md。

- [x] 记录 `npm install`、`npm run dev`、`npm run lint`、`npm run typecheck`、`npm run build`、`npm test`、`npm run start` 用法，明确预览和空状态限制。
- [x] CI 在 Ubuntu 使用 Node 24、npm ci、lint/typecheck/build、Playwright Chromium 测试。
- [x] 实际运行安装、所有检查、生产启动测试与 PC/iPad 可视检查；检查 diff 仅涉及前端范围及无敏感信息。
- [x] 记录红绿灯和结果，分模块提交，推送功能分支；不创建 PR。
