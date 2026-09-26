# Phase 2 合并前独立审查

审查范围：`main`（`a6d8ec0`）到 `b0a129e`，覆盖后台页面、BFF、认证、客户、商品、项目、SceneModel、版本迁移、租户隔离、并发、测试与 CI。

独立 reviewer 发现 0 个 Critical、3 个 Important、2 个 Minor。Important 分别是有效会话可被过期入口误清除、详情/编辑页常见服务错误无中文恢复界面、表单网络错误与退出失败缺少可用提示。现已修复，并增加 12 个浏览器回归测试。两个 Minor 也已修正：仪表盘的过期说明、SceneState 字段文档。没有发现 SceneVersion 并发、事务或迁移约束的可复现缺陷。针对恢复损坏历史快照的额外测试仍是后续测试建议，不代表已发现生产缺陷。

本地验证：生产构建模式 Playwright **81 passed**；前端 lint、typecheck、build 通过。真实 PostgreSQL 后端 pytest **325 passed, 3 skipped, 2 warnings**；3 个跳过项是 Windows 符号链接测试。Ruff check、Ruff format、Alembic upgrade、SceneModel/OpenAPI 契约检查通过。Git 全历史敏感信息扫描未发现实际密钥或禁止跟踪的环境文件。本机没有 Docker 可执行文件，Docker 构建以本次提交对应的 GitHub Actions 为准。

上述浏览器测试使用模拟 FastAPI。Phase 2-6 的真实 PostgreSQL + FastAPI + 浏览器 v1→v2→恢复 v1 为 v3 联调证据见既有验收记录；本轮前端错误处理修复没有修改后端或场景协议。最新 SHA 的 CI 链接和状态以 PR #2 描述及 Actions 为准，不用旧提交的 CI 代替。

## 2026-09-26 最新验收与真实冒烟

已验收代码 SHA：`14b35d2f5cec4698d5b62643870db61addfad74e`。独立修复复核确认全部 Important 已解决；测试进一步覆盖 200 响应含损坏 JSON、网络失败后编辑草稿保留。

- [前端 Actions 36164156165](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36164156165)：success，81 passed，lint/typecheck/build 成功。
- [后端 Actions 36164156151](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36164156151)：success，328 passed、2 warnings，Ruff、迁移、契约、Docker 成功。
- 2026-09-26 14:31 UTC，在独立新建的专用验收数据库上运行真实 PostgreSQL + FastAPI + 生产构建 Next.js + Edge；未修改既有用户数据。浏览器完成登录 → 新建专用张先生客户 → 从客户详情创建项目 → 保存 v1 → 修改保存 v2 → 恢复 v1 生成 v3 → 刷新确认 v3，并读取确认 v1/v2/v3 都保留。
- 同一真实流程验证旧 `base_version=1` 保存返回 409，另一个专用商户读取项目、当前场景、版本列表及 v1 均返回 404；浏览器 storage 为空。恢复结果与服务端规范化后的 v1 快照一致。
- 第一次准备的 `.test` 邮箱被现有后端 schema 拒绝，改用 `example.com` 专用邮箱后验收通过；测试脚本使用浏览器同源 fetch 验证生产 Secure Cookie，不用独立 HTTP 请求上下文冒充浏览器。以上为验收工具修正，未修改产品实现。

PR #2 保持 open，尚未合并。后续 Unity 子系统以该已验收代码为基础；不得把 PR 可合并状态记为已合并。
