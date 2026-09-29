# Windows 离线在售商品目录设计

## 目的与边界

门店在同一台 Windows 电脑上维护真实在售商品的名称、品牌、分类、SKU、售价和毫米尺寸，能搜索、筛选、新建、查看和编辑。资料与已经完成的本地客户、项目和场景一起保存在 `%LOCALAPPDATA%\ZhinengFamily\scenes.sqlite`，关闭和重启后仍可使用，不依赖 FastAPI、PostgreSQL 或外网。

这一阶段的“在售商品”与内置四款授权**演示 3D 模型**明确分开。没有商家提供并验证的模型文件，就不在 3D 场景中宣称显示了实际 SKU。图片/GLB 导入、商品与场景实例关联、报价与订单留到后续阶段；本阶段不增加会被误解为可加载的 URL 输入框。

## 数据与迁移

在现有 SQLite v2 上增加 v3 `local_products` 表。每行包含由本机生成的 `id`、`workspace_id`、`category`、`brand`、`name`、`sku`、`price` 十进制字符串、`width_mm`、`depth_mm`、`height_mm`、`metadata_json`、`revision`、`created_at`、`updated_at`。`(workspace_id,sku)` 唯一，查询和修改始终依据 LocalIdentity 的 workspace，而不接受客户端提供租户、ID 或创建人。金额以字符串验证及保存，不做 JavaScript 浮点运算；尺寸需为正且有限。

从 v2 升级前生成唯一的 `.pre-v3-*.bak` SQLite 在线备份。建表、索引和 `user_version=3` 在同一事务；失败回滚。v1 数据库先按已验证路径升级 v2，再升级 v3，各阶段备份独立保留；v3 重新打开不产生新备份。既有客户、项目、场景与历史不变，备份须能复制到新路径后重新打开。新表不保存真实密码或远端 JWT。

## 本机桥接与界面

沿用同源、HttpOnly 本机会话的 Browser → Node loopback → C# bridge → SQLite 路径。桥接增加 `products`（`limit`/`offset`/`search`/`category`）、`product_create`、`product`、`product_update`。更新携带 `base_revision`；过期编辑返回 409 并保留页面输入。SKU 冲突给中文提示；不存在或跨 workspace ID 返回 404，错误不回显数据库内部信息。

商品页面与设计工作台分开，默认仍进入设计工作台。列表显示名称、品牌、分类、SKU、价格和 `宽 × 深 × 高 mm`；缺失可选字段显示 `—`。页面大小 20，搜索 name/SKU/brand、分类文本筛选可组合并保留翻页条件。新建与编辑表单使用中文必填与错误信息；`metadata` 采用简单 JSON 输入，空内容为 `{}`，对象以外、非法 JSON 或非有限数均不得转发。UI 明确标注“暂无与该 SKU 对应的真实 3D 模型”。

## 验收

真实 SQLite 测试覆盖新旧数据库升级、唯一备份/恢复、失败回滚、工作区隔离、SKU 冲突、金额原样保留、非法尺寸/元数据、搜索/筛选组合、正确 total/分页、过期编辑。桥接测试使用真实 SQLite；真实 Edge 测试覆盖商品创建、搜索、详情/编辑、刷新/服务重启、中文错误、无浏览器 token，以及 iPad 横屏宽度。完整离线核心与 Windows 便携包重跑，审查后推送到新的 draft PR；不合并级联 PR。
