# Windows 本地版验证记录

本次交付：Windows 本地 3D 场景体验版，继承 Phase 3 的 SceneModel/SQLite 存储核心。最新提交、CI 结果以对应 Actions 作业结束后补录，不将既有 SHA 的绿色作业当成新代码验证。

## 本机实际证据（2026-09-28）

- 设备：Windows、RTX 3070、约 16 GB RAM；用户无需 Mac。
- Unity：官方 Hub 3.15.2 安装包 Authenticode `Valid / Unity Technologies`，已安装；6000.3.0f1 Editor 官方 URL 重定向到 China CDN 后返回 HTTP 404。**Unity Editor 编译、7项 Editor 测试、Unity Player 构建/运行：未执行。**未绕过许可证或模拟成功。
- 替代 Windows 客户端：在本机使用 Edge 无头浏览器运行并截图；拦截一切非本机网络请求。Khronos 原版沙发 glTF（10,107,912 字节，SHA256 `5349e042ad41e695e89f1110230c4ee0c75b2bc62ef830c7016be6ecf665bfb6`）在场景中加载了真实纹理、PBR 光照与阴影。图像见 [实际画面](images/windows-local-sofa-v3.png)；不是 AI 生成。
- 实际浏览器流程：新建 → 载入两室一厅 → 保存 v1 → 改位置保存 v2 → 查看/恢复 v1 生成 v3 → 刷新并读取 v3；另测非法 JSON、409 保留草稿和切换空方案清理旧渲染。
- 新增 Windows 本地/真实 SQLite/浏览器/便携包测试：最终本机打包测试 **26 passed**，包括服务重建读取同一 SQLite 场景。
- 现有离线核心真实 SQLite/协议验证：原完整 `tools/test_offline_core.ps1` 已通过，含 256 个权威协议案例、版本并发事务和多个回归套件；新桥接测试重用同一实现，避免另造协议。
- 格式、语法：本地 `npm run format:check` 和 `npm run check` 已通过；更新后的最终提交需要重新跑。
- 便携程序：`智能家居.exe --smoke-test` 已启动打包 Node 服务、读取本地页面并关闭所拥有的服务，包内模型哈希和许可证验证通过。最终版本须重新生成并复验。

## 验证边界

本地验收与 GitHub Actions 各自记录，不把测试夹具当成部署环境。当前体验版仅一款沙发；其它家具模型、商品离线目录与完整门店工作流仍未完成。Windows 应用为本机 Edge 窗口和回环服务，非 Unity/iOS 安装包。便携 exe 无商业代码签名，Windows 可能提示确认来源；用户资料存于 LocalAppData 而非应用目录。

