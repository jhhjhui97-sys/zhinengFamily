# iPad 独立离线版：方向与 Phase 3-2A 设计草案

状态：用户已确认「iPad 独立运行，电脑不用开，不连接局域网」。用户随后明确委托技术决策及执行，当前按实施计划开发 Phase 3-2A；设备验收尚未执行。
代码基线：Phase 3-1 `7b70833fa1c86c7315135974ce9327d04cb70711`，草稿 PR #3；Phase 2 PR #2 尚未合并。保留两个阶段已有代码与提交，不回退、不擅自合并。

## 用户要得到什么

最终交付是在 iPad 上安装并运行的应用。日常打开、查看、编辑和保存客户、商品、设计项目及场景无需运行电脑，无需互联网或门店局域网。资料保存在设备上；备份和迁移通过用户主动导出/导入完成，不实现云同步。

「独立运行」指使用时不需要电脑；开发、签名和安装 iOS 应用仍需要构建环境。当前 Windows 没有 Unity Editor/许可或 macOS/Xcode，不能宣布已有可安装的 iPad 包。

## 方案比较与建议

| 方案 | 适用与取舍 |
|---|---|
| Unity iPad 客户端 + SQLite（建议） | 复用现有场景消费者；设备数据库承载本地数据与版本事务，适合后续客户/商品/项目关系。需要 iOS 原生数据库绑定及 IL2CPP 验证。 |
| Unity + 独立 JSON 文件 | 单场景复制最简单；多个关联记录、历史版本与当前指针的一致性需要自行实现，后续迁移工作较多。 |
| Web/PWA 离线改造 | 部分表单外观可借鉴；当前 Next.js 服务端/BFF/FastAPI 不能原样离线运行，存储和 3D 入口也要改造，不作为本步骤路线。 |

建议路线是 Unity + SQLite。已有 PostgreSQL/FastAPI/Next.js 保留为已完成的独立代码与契约参考，不成为 iPad 的必需运行服务。iPad 上不部署 Node.js、Python 或 PostgreSQL。

## 保留与改变

- 保留 SceneModel 1.0.0、mm、RH_Z_UP、完整 JSON，以及现有坐标适配、场景渲染代理与相机。
- 客户/商品/项目的字段与规则以后从已有契约迁移；本步骤不重新实现这些业务界面。
- iPad 单机操作不需要服务器 JWT 或联网登录。本机 workspace/actor UUID 仅用于来源记录，不冒充服务端认证、用户权限或商户授权。
- 当前 Web 后台继续使用其原有 BFF/HttpOnly Cookie；不削弱其安全规则，也不将 JWT 搬到 Unity。
- 不把 Unity 展示对象反向拼成新协议，不丢失门窗、水电或 metadata 等尚未显示的字段。

## 本次只做 Phase 3-2A：本地数据核心

输出是可测试的本地场景库与完整离线校验基础。暂不移植 Customer/Product/DesignProject CRUD 界面，不建设完整 3D 编辑器。

本地 `scene_documents` 是场景文件库条目，不冒充后端 DesignProject。每条记录包括本机生成的 id、workspace_id、名称、当前 revision 与保存时间。`scene_versions` 保存不可变完整 SceneModel JSON、document_id、revision、created_by、created_at；unique(document_id, revision) 防止重复版本。父子关系同时约束 workspace，所有访问由当前本机上下文筛选。

仅为离线样例建立最小家具目录快照（真实写入本地库的 UUID、名称、尺寸），不提供商品管理界面。样例家具引用必须存在于该本机目录，不把当前硬编码示例 UUID 当成服务端业务商品。以后移植商品数据时另做显式迁移。

保存以 base_revision 为前提：0 → v1，v1 → v2；过期 revision 返回冲突，不覆盖未保存内容。恢复 v1 在当前 v2 基础上产生 v3，v1/v2 不变。事务内完成版本插入及当前指针的条件更新，任何失败全部回滚；使用数据库写事务与唯一约束，不能只「先读后无条件写」。冲突、数据库忙、损坏、磁盘写入失败显示不同的安全中文提示。

数据库格式版本、本地 revision 与 SceneModel schema_version 分开管理。可写文件存入设备应用数据目录；StreamingAssets 只作只读种子。关闭应用后重新打开必须能读取已提交的当前版本与历史。

## 正式保存前必须完整校验

`SceneDocument.Parse` 只是预检查，不能直接作为离线版本提交的校验器。结构约束从权威 `packages/scene-schema/scene.schema.json` 派生；额外语义与现有 `scene.py`、`elements.py`、`geometry.py` 保持一致，不手写第二套字段协议。

校验至少包含：字段/类型/UUID/协议版本、有限数及正尺寸、全局 ID 唯一、楼层/房间/墙引用、同楼层关联、有效房间轮廓、非零墙段、门窗尺寸范围，以及家具引用的本地目录存在性。不将 JSON Schema 校验等同于 Pydantic 自定义语义校验。

建立共享合法/非法契约样例，同时交给权威 Python 与 C# 检查；逐类核实通过/拒绝的一致性。校验失败不写正式版本、不改变当前指针。未完成的编辑草稿与正式版本分开标记，不能把非法草稿当作有效 SceneModel。

## 依赖准入与备份

实现计划的第一个任务先验证 SQLite 绑定与校验依赖：真实 C# 打开数据库、事务写入、关闭重开、回滚与竞争写入；再执行 Unity Editor 导入和 IL2CPP/iOS ARM64 兼容性检查。优先选择无付费运行依赖、明确支持本地运行且不依赖 JIT/动态代码生成的实现。依赖版本只在官方资料及可执行验证核实后锁定，不预先声称普通 .NET 结果代表 iPad 兼容。

导出 SceneModel JSON 与数据库备份不同。数据库备份使用 SQLite 一致性快照机制，不直接复制可能正在写入的数据库文件。核心提供导出/恢复入口及失败不覆盖原数据的测试；iPad Files 文件选择与分享 UI 属于后续最小界面步骤，需要真实原生桥接验收。本阶段不实现图片/模型上传或云备份。

## 执行顺序与验收

1. 核实并锁定数据/校验依赖；若 iOS 兼容无法验证，记录环境缺口，不能标为通过。
2. 用共享契约反例补齐离线完整校验，先测试失败再实现。
3. 用真实 SQLite 和独立连接测试首次保存、再次保存、分页读历史、恢复产生新版本、旧历史不变、旧 base_revision、并发写入和事务失败。
4. 测试重启重新打开、损坏文件、目录隔离、非法商品引用及一致性备份/恢复；错误信息不包含 SQL、路径详情或内部异常。
5. 保留现有 C# 坐标/JSON、Python 契约及前后端回归检查；独立审查、分步提交和对应 SHA 的真实 CI。

本步骤的核心验收链：本地库 → 合法示例保存 v1 → 改房间名称保存 v2 → 恢复 v1 产生 v3 → 关闭重开 → v3 与 v1/v2 均仍存在。所有步骤不请求服务器。

后续 Phase 3-2B 再接最小 iPad 界面和文件分享；随后逐步移植客户/商品/项目管理，仍不一次写完整 App。iPad 独立版最终验收必须包括关闭电脑、断开局域网、飞行模式冷启动、保存后强制退出再重开及备份恢复。

Phase 3-1 的 Unity 引擎编译/EditMode/Play 验收尚未完成。纯 C# 本地核心可以先开发，但查看器集成和 iPad 可运行结论必须等真实 Unity 与设备验证；当前缺口不能用 Mock 替代。

## 本步骤不做

不合并已有 PR；不移植全后台；不做云同步、账户服务器、用户管理、CAD/PDF/AI/VR、上传、报价或订单。完整 iPad 商业版与本地数据核心是两个不同的交付状态。

## 参考与当前证据

- [Unity iOS 构建过程](https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/iphone/ios-building-and-delivering/build-process)：Unity 生成 Xcode 工程，macOS/Xcode 构建本地应用。
- [Unity 应用数据目录](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Application-persistentDataPath.html)：设备内持久化目录。
- [SQLite 原子提交](https://www.sqlite.org/atomiccommit.html)、[事务](https://www.sqlite.org/lang_transaction.html)：事务一致性及写入串行行为。
- 既有源码与执行证据：`apps/unity-client/README.md`、`docs/phase-3-1-verification.md`、[草稿 PR #3](https://github.com/jhhjhui97-sys/zhinengFamily/pull/3)。本设计不声称新增代码或测试已完成。
