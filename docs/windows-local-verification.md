# Windows 本地版验证记录

## 离线客户 → 项目 → 场景（2026-09-29）

本节记录独立于旧四模型基线的新工作。Windows 本地程序新增客户及项目的创建、列表、编辑，场景与项目关联，旧场景仍从“旧方案入口”读取。首次打开 v1 SQLite 数据库时，先生成不覆盖旧文件的 `pre-v2` 备份，再在单一事务中升级到 v2；测试已将备份复制到新路径、重新打开并读到原场景及完整版本历史。在线后台与本地资料不会自动同步。

- 本机真实 SQLite：`tools/test_offline_core.ps1` 全部通过，包含 256 个协议权威案例、数据库并发、迁移失败回滚、备份恢复、客户/项目归属和不可变场景版本。
- 本机真实 Edge（无外部网络）：客户张先生 → 龙湖小区120㎡ → 客厅设计 → 保存 v1 → 修改保存 v2 → 恢复 v1 生成 v3 → 重启本地 HTTP 服务 → 重新读取 v3 和 v1/v2 历史。另验证旧场景仍可打开、跨客户/项目访问失败、过期编辑保留输入、客户/项目未保存表单离开提醒和 1024px 横屏布局。实际画面见 [截图](images/windows-offline-sales-room.png)，不是概念图。
- Windows 便携包的构建、测试、源提交 SHA 和 GitHub Actions 应以本轮最终提交后复验结果为准；以下旧节的 CI 链接仅对应当时的四模型基线，不能作为本轮通过证据。

仍未完成：离线在售商品管理、报价/订单、CAD、AI 自动布局、Unity/iPad 安装包及高保真房间材料。四款有纹理的演示模型不代表门店商品。

## 历史四模型基线（2026-09-28）

本次交付：Windows 本地 3D 场景体验版，继承 Phase 3 的 SceneModel/SQLite 存储核心。本轮新增四款演示模型目录及按房间放置家具。以下先记录本机候选包验证；正式便携包和 CI 均须对应实际提交 SHA，不将既有 SHA 的绿色作业当成新代码验证。新增目录代码的最新 Actions 链接见 [PR #6](https://github.com/jhhjhui97-sys/zhinengFamily/pull/6) 的检查列表。

## 本机实际证据（2026-09-28）

- 设备：Windows、RTX 3070、约 16 GB RAM；用户无需 Mac。
- Unity：官方 Hub 3.15.2 安装包 Authenticode `Valid / Unity Technologies`，已安装；6000.3.0f1 Editor 官方 URL 重定向到 China CDN 后返回 HTTP 404。**Unity Editor 编译、7项 Editor 测试、Unity Player 构建/运行：未执行。**未绕过许可证或模拟成功。
- Windows 客户端：在本机使用 Edge 无头浏览器运行并截图；拦截一切非本机网络请求。四款 Khronos 示例模型在同一个场景中加载成功，均有真实纹理、PBR 光照与阴影；沙发与单人椅画面见 [实际截图](images/windows-local-catalog-room.png)，不是 AI 生成。模型许可与哈希见 [素材清单](../apps/windows-local/ASSET-LICENSES.md)。
- 实际浏览器流程：新建 → 载入两室一厅 → 保存 v1 → 改位置保存 v2 → 查看/恢复 v1 生成 v3 → 刷新并读取 v3；另测非法 JSON、409 保留草稿、未应用输入防丢失和切换方案清理旧渲染/历史。
- Windows 本地/真实 SQLite/浏览器/便携包测试：本机本轮候选打包测试 **36 passed、0 failed**，新增目录注册、家具放置、四模型加载并持久化、缺失模型明确提示、窄房间连续摆放不得越墙、满房间拒绝继续添加以及随包作者署名检查；保留服务重建读取同一 SQLite 场景、原生启动器 smoke test 和浏览器输入丢失回归。正式包须从干净提交重建并复验。
- 离线核心真实 SQLite/协议验证：本轮完整 `tools/test_offline_core.ps1` 已通过，含 256 个权威协议案例、版本并发事务和多个回归套件；新桥接测试重用同一实现，避免另造协议。
- 格式、语法：本轮本地 `npm run format:check` 和 `npm run check` 已通过。
- 便携程序：`智能家居.exe --smoke-test` 已启动打包 Node 服务、读取本地页面并关闭所拥有的服务，包内模型哈希和许可证验证通过。上一提交的包还曾在本机打开独立 Edge 应用窗口，确认本机页面 HTTP 200、SQLite 文件已建立；正常关闭后，窗口、启动器和所拥有的本机服务均退出。四模型正式包仍须在干净提交后重新生成并做可见窗口验收。

## 验证边界

本地验收与 GitHub Actions 各自记录，不把测试夹具当成部署环境。上一提交 `02fe0a556c5387bd0d5cc4ccad0aa1972c5b8b43` 的 [Windows Local CI](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36379158337) 已通过 29 项测试，[Scene consumer core](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36379158387) 和 [后端](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36379158458) 亦通过；这些**不是**新增四模型代码的 CI。当前体验版只有四款固定演示模型；门店在售商品的离线目录与完整工作流仍未完成。Windows 应用为本机 Edge 窗口和回环服务，非 Unity/iOS 安装包。便携 exe 无商业代码签名，Windows 可能提示确认来源；用户资料存于 LocalAppData 而非应用目录。
