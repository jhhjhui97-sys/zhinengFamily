# 数据字典与扩展边界

Phase 1 建立五个核心实体；Phase 2-6 增加场景当前指针和不可变版本快照。下文其他实体仍是后续关系设计，并不表示已有 API。

## 6. 数据库与 SaaS 边界

Phase 1 迁移真正建立 Merchant、User、Customer、Product、DesignProject。其余实体在数据字典中定义关系，本期不建空业务 API。所有核心租户表具有 merchant_id 外键及索引；租户实体增加 `(merchant_id,id)` 唯一约束，跨实体用复合外键阻止跨商家绑定。

| 实体 | 关键字段/关系 |
| --- | --- |
| Merchant | id、name、created_at、updated_at |
| User | id、merchant_id、email、password_hash、role(owner/sales)、is_active、created_at；商家内规范化 email 唯一 |
| Customer | id、merchant_id、owner_user_id、name、phone、wechat、source、address、budget>=0、status(new/following/won/lost)、notes、last_follow_up_at、created_at、updated_at |
| Product | id、merchant_id、category、brand、name、sku、price>=0、width_mm/depth_mm/height_mm>0、thumbnail、model_url、metadata、created_at、updated_at；merchant+sku 唯一；ORM 属性 product_metadata 映射 metadata 列 |
| DesignProject | id、merchant_id、customer_id、sales_user_id、name、address、status(draft/active/archived)、created_at、updated_at |
| ProductAsset | merchant_id、product_id、object_key、media_type、checksum、asset_kind；复合外键归属商品 |
| FloorPlan | merchant_id、project_id、object_key、source_format、parse_status；保留原文件 |
| SceneState | merchant_id、design_project_id、version；每个项目一行，复合外键精确指向当前 SceneVersion；保存时间取当前版本的 created_at |
| SceneVersion | id、merchant_id、design_project_id、version、scene_data JSONB、created_by、created_at；项目内版本唯一，快照不可变 |
| FurnitureInstance | 未来按 SceneVersion 投影建立 merchant_id、scene_version_id、instance_id、product_id；快照仍是场景权威来源，禁止独立双写 |
| Quotation / Item | merchant_id、project_id、scene_version_id、status、currency、total；子项存名称/SKU/数量/单价/金额快照及 product_id |
| Order / Item | merchant_id、quotation_id、customer_id、status；订单项独立价格快照，不随商品调价变化 |
| RenderJob | merchant_id、scene_version_id、status、output_object_key、error_code、created_at |

Merchant 不带 merchant_id。未来子表同样保留 merchant_id 并用复合外键约束；删除采用 restrict，Phase 1 不提供删除。
