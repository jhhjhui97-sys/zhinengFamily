# Windows 本地设计工作室

这是可以在 Windows 10/11 本机运行的**离线 3D 场景体验版**。双击便携包中的 `智能家居.exe`，独立 Edge 窗口会自动打开；不需要 Mac、Unity、Node、Python、PostgreSQL 或外部服务器。运行机器需要 Microsoft Edge 与 .NET Framework 4.8。资料在 `%LOCALAPPDATA%\ZhinengFamily\scenes.sqlite`，请定期备份整个目录；升级便携包时保留该目录。便携目录可放在任意本地磁盘，路径中有空格和中文也可启动。

操作：新建方案 → 载入两室一厅 → 从演示目录选家具及房间放入场景 → 拖动/滚轮查看 → 调整家具 X/Y 坐标及角度 → 保存 v1/v2 → 查看版本 → 恢复旧版生成新版本。支持只读历史 JSON、高级场景 JSON 校验和导出真实渲染 PNG。冲突返回中文提示并保留未保存内容。场景使用原有 SceneModel 全量校验和 SQLite 不可变版本，C# 桥接在本机运行。Node 服务只监听 `127.0.0.1` 随软件启动，退出窗口后由启动器关闭。浏览器没有 FastAPI JWT，也不连接远端 API；端口是临时分配的。

内置四款 Khronos glTF 示例模型：复古三人沙发、织物单人椅、丝绒沙发和商用冰箱，含真实纹理与材质；物理光照、阴影与场景中毫米尺寸放缩均使用本地资源。模型创作者、许可和文件哈希见 [第三方素材清单](ASSET-LICENSES.md)。这些是演示商品，不能代表商家实际库存。[这张图](../../docs/images/windows-local-catalog-room.png)来自实际 Edge 离线客户端，画面中的沙发与单人椅不是 AI 生成的效果概念图。

当前限制：家具目录只有四款演示模型，摆放仍是简单位置/角度调整。房间地面、墙面为基础材质，没有铺装或丰富灯具；尚未把已有后台的客户/商品/项目 CRUD 移植到离线 Windows 应用，也没有自动 AI 布局或原生 CAD/VR。这是可用的本地场景设计体验版，**不是完整门店交付系统**。Unity 6000.3.0f1 工程保留，但本机官方 Editor 下载重定向到返回 404 的节点，因此 Unity Editor/Player 未验收；Windows 版采用不依赖 Unity 许可的本地浏览器渲染。

开发构建：先运行 `npm ci --prefix apps/windows-local`，准备 Node24、Newtonsoft.Json 13.0.2 `net45` DLL 和对应许可证，再运行 `tools/package_windows_local.ps1`。该脚本拒绝覆盖已有输出目录。运行 `npm test --prefix apps/windows-local`、`npm run check --prefix apps/windows-local`、`npm run format:check --prefix apps/windows-local` 验证。证据见 [Windows 验证记录](../../docs/windows-local-verification.md)。
