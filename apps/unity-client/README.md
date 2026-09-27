# iPad 独立离线客户端源工程

目标是在 iPad 上独立使用，日常无需电脑、局域网或互联网。当前已有 Phase 3-1 只读场景消费者、Phase 3-2A 本地场景核心及 Phase 3-2B 本地操作界面源码；**尚无可安装的 iPad 包，尚未完成设备验收**。

## 当前可验证的核心
- SceneModel 1.0.0 / mm / RH_Z_UP 原协议，完整 JSON 留存；离线校验结构、几何、对象关联及有限数。
- 本地 SQLite 场景文件库，首次保存 v1、修改 v2、恢复 v1 创建 v3；历史不可改删。
- current 指针及版本快照在同一 BEGIN IMMEDIATE 事务写入；旧 baseRevision 返回 Conflict，调用者应保留未保存内容。
- 单个 workspace 内的 catalog 快照验证 furniture_instances.product_id。workspace/actor 是本机来源记录，不能当作远端商户授权。
- 原生 SQLite 在线备份，目标必须是新文件，已存在文件不会被覆盖；恢复验证通过打开备份读取全部历史完成。导入/文件分享 UI 尚未实现。
- 没有联网登录或 JWT。后台 Web/FastAPI 保留，不是最终 iPad 日常运行依赖。

本阶段不移植客户、商品、设计项目 UI，不实现可视化编辑、CAD、AI、报价、上传或 VR。场景文件库不冒充后端 DesignProject。

## 打开本地场景界面（需要 Unity Editor）
1. Unity Hub 安装工程指定的 Unity 6000.3.0f1；生产交付前升级并验证维护补丁。
2. 打开本目录并等待固定版本依赖安装。
3. 菜单 SceneConsumer → Create Demo Scene，保存生成场景后 Play。
4. 新建场景 → 载入两室一厅 → 保存 v1 → 修改房间名称并应用 → 保存 v2 → 查看 v1 → 确认恢复生成 v3。
5. 关闭后再启动，在场景库打开资料，确认当前 v3 和原有历史。保存写入 Application.persistentDataPath/local-scenes.sqlite；使用电脑本地路径不需要服务器。
6. 输入框/历史列表操作不会启动相机手势；触摸、键盘、中文字体及实际布局仍须 Editor/iPad 验证。

房间为轮廓、墙为实体方块、家具为代理方块，门窗数据保留但不切洞。显示坐标为 (x,z+elevation,y)/1000，尺寸为 (width,height,depth)/1000。界面源码已接到本地核心，尚未进行 Unity 引擎编译或实机验收。高级 JSON 不合法或版本冲突时保留草稿；切换或恢复时明确确认放弃修改。未保存草稿仅在内存，强制退出可能丢失未保存修改。

## 本地存储接口
使用 LocalScenes.LocalSceneStore(path, workspaceUuid, actorUuid, validator)。界面从 Application.persistentDataPath 构造路径；禁止使用 StreamingAssets 写数据库。

创建 OfflineSceneValidator 时传入 StreamingAssets/scene.schema.json 内容。这是现有生成协议的副本，生成器检查漂移；未知 schema 关键字会拒绝。严格 JSON 解析保留 BigInteger，拒绝重复键、非有限数及非标准 JSON。8 MiB 和 128 层为资源限制。

LocalIdentity.Open(path) 读取持久 workspace/actor，既有单 workspace 库可沿用，多 workspace 歧义拒绝。Documents(limit=20,offset=0) 返回分页条目和 total。Create(name) 创建场景库条目；Current(id) 未保存时返回 null；Put(id,baseRevision,json) 完整校验后保存；Versions(id,limit,offset) 倒序分页；Restore(id,baseRevision,revision) 重验旧 JSON 并追加版本。ExportVersion 输出完整 JSON；BackupTo 输出一致数据库备份。

示例家具引用明确的离线 product UUID。测试先在同一 workspace 用 Catalog 注册真实本地快照；不将示例 UUID 提交到服务器，不自动把外来商品当作本地商品。

SQLite 格式版本 PRAGMA user_version=1 与场景 revision/schema_version 分开。未知格式拒绝打开，不降级或覆盖数据库。SQL 使用绑定参数；history 约束包括复合外键、唯一版本和禁止改删的触发器。

## 检查
从仓库根目录运行：
```text
python tools/export_unity_sample.py --check
python tools/export_offline_validation.py --check
dotnet run --project apps/unity-client/Tests/ConsumerTests.csproj -- apps/unity-client/Assets/StreamingAssets/two-bedroom.json
dotnet run --project apps/unity-client/Tests/OfflineTests.csproj -- apps/unity-client/Assets/StreamingAssets/scene.schema.json apps/unity-client/Tests/Fixtures/offline-validation.json apps/unity-client/Assets/StreamingAssets/two-bedroom.json
```

Linux 需要系统 libsqlite3 开发库。Windows 无 .NET SDK 时可用 tools/test_offline_core.ps1 -NewtonsoftDll <可信的 Newtonsoft.Json 13.0.2 DLL 路径>，使用系统 C# 编译器和 winsqlite3。编译分成 Core、LocalScenes、Tests，检查实际程序集边界。

这些运行的是生产核心 C# 和真正 SQLite，没有模拟数据库；不编译 Unity 引擎，不代替 Editor/IL2CPP/iPad。共享用例的预期由真正 Pydantic SceneModel 生成。

## iPad 构建和未完成项
需要 Unity iOS Build Support、macOS/Xcode、签名及设备部署。iOS 原生绑定选择 __Internal，Xcode 的 UnityFramework 需链接 libsqlite3.tbd；此步骤、IL2CPP、设备存储/生命周期/触摸均尚未执行。Windows 用系统 winsqlite3，Linux/macOS 用 sqlite3，不附带未知二进制。

当前电脑没有 Unity Editor/许可或 Xcode。本地保存/历史 UI 源码已经接入，后续须完成 Unity Editor 编译/Play、真正 iOS 工具链和 iPad 验证；不能凭核心测试宣布 iPad App 已完成。

证据见 [Phase 3-2A 验证记录](../../docs/phase-3-2a-verification.md)。

## Unity 引擎验证命令（未执行）
安装并激活工程指定 Editor 后，从仓库根目录执行，将 Unity 路径替换为本机已安装路径：
```text
Unity.exe -batchmode -projectPath apps/unity-client -runTests -testPlatform EditMode -testResults editor-results.xml -logFile editor-tests.log
```
只有实际报告无编译错误且测试通过，才通过引擎 gate。再用 Play 验证以上操作、输入框滚动、横竖屏、安全区域和字体。不能用 C# 控制台通过替代。

UI 使用官方 [PanelSettings](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/UIElements.PanelSettings.html)、[FontDefinition.FromFont](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/UIElements.FontDefinition.FromFont.html) 和系统中文字体；目标设备字形仍须验证。
证据见 [Phase 3-2B 验证记录](../../docs/phase-3-2b-verification.md)。
