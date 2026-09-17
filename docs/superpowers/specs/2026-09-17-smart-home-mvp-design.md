# 智能家居 MVP 总体设计与 Phase 1 边界

日期：2026-09-17。目标仓库：`jhhjhui97-sys/zhinengFamily`。

状态：设计评审稿，尚未实现。最新附件明确本次只执行 Phase 1，覆盖此前笼统的 Phase 1 → Phase 3 请求。

## 1. 仓库检查

- GitHub 插件确认仓库存在，公开仓库，默认分支配置为 main，branches API 返回空数组。
- 本地目录只有 `.git`；当前 unborn 分支为 master，没有提交、远端关联或工作文件。
- 因而不存在 README、package/Python 配置、已有业务代码、测试、文档或 AGENTS.md。
- 不创建新的 GitHub 仓库。实施时关联上述已有仓库，在 `codex/phase-1-foundation` 开发。
- 当前 PATH 中 Git 可运行；Python 指向 WindowsApps 别名；未发现 uv、docker、gh。不能据此断言机器完全没有这些软件。
- `git ls-remote` 因当前 Git 缺少 remote-https helper 失败。远端内容检查改用 GitHub 插件；推送能力尚未验证。

## 2. 产品和交付范围

最终流程：销售员登录 → 客户 → 房屋项目 → 上传 CAD/DXF/DWG/PDF → SceneModel → 3D 房屋 → 商品选配 → LayoutEngine 初排 → iPad 调整 → ValidationEngine 检查 → 实时 3D → 效果图 → 商品清单/报价 → 保存方案 → 订单 → CRM 跟进。

Phase 1 交付：可运行 FastAPI、真实 PostgreSQL、SQLAlchemy/Alembic、商家与用户初始化、认证、客户/商品/项目 Create/List/Get/Update、租户隔离、SceneModel 协议及示例、存储接口、Swagger、Docker、测试、CI、README。

Phase 1 不实现 Unity、CAD 解析、PDF AI 识别、自动摆放、几何碰撞引擎、渲染、VR、支付或 Image-to-3D。SceneModel 的协议验证不等于空间可用性判断。后台 Next.js 暂不初始化，Swagger 满足本期操作入口。

## 3. 架构选择

采用 Modular Monolith：同一个 API 进程中按 auth、merchants、customers、products、projects 分模块；共享事务与数据库。Python 3.12、FastAPI、Pydantic 2、SQLAlchemy 2.x、Alembic、PostgreSQL 16、psycopg 3、pytest、Ruff。具体依赖版本在安装验证时锁定。

候选方案比较：

| 方案 | 优点 | 成本及决定 |
| --- | --- | --- |
| 模块化单体 + 关系业务表 + Scene JSONB 快照 | 单一事务、协议可复用、便于交付 | 推荐；版本数据需要协议校验 |
| 所有场景几何拆为关系表 | SQL 可逐元素查询 | 编辑及版本复制复杂，本期不采用 |
| 提前拆微服务 | 可独立扩缩容 | 运维和一致性成本高，本期不采用 |

API 使用同步 SQLAlchemy Session，同步路由处理数据库 I/O；请求结束关闭 session，失败回滚。持久化 ID 使用 UUID，时间为 UTC timestamptz，金额为 Decimal/Numeric(12,2)，人民币 CNY，不使用浮点存钱。

最终 Next.js/TypeScript strict 管理端与 Unity iPad/iOS 客户端经 OpenAPI 调用后端。解析、布局、校验、渲染模块只接受/输出版本化 SceneModel 或结构化结果；未来重任务才进入 worker，不在本期建立独立服务。

## 4. Monorepo

Phase 1 实际需要的目录：

```text
apps/api/src/smart_home/       # 模块化业务后端
apps/api/alembic/              # PostgreSQL migrations
packages/scene-schema/         # scene_schema Python 包、JSON Schema、示例
packages/api-contracts/        # 导出的 OpenAPI JSON 和导出脚本
infra/docker/                 # API Dockerfile
docs/architecture/            # 数据字典、协议说明
docs/superpowers/specs/        # 本设计
docs/superpowers/plans/        # 实施计划
tests/                        # 协议、API、数据库集成测试
```

根目录包含 pyproject.toml、依赖锁、docker-compose.yml、.env.example、README.md、.gitignore、.github/workflows/ci.yml。admin-web、unity-client、services 的目录在有实际代码时创建；这是对建议结构的有意精简，避免空壳服务。

## 5. SceneModel：唯一场景交换协议

### 5.1 权威来源与版本

`packages/scene-schema/src/scene_schema/` 中的 Pydantic 模型是类型定义源，导出 JSON Schema 2020-12；禁止手工维护两套字段定义。OpenAPI 引用相同模型。JSON Schema 负责结构约束，Python 校验器负责引用和几何基础约束；文档必须说明跨字段校验不能全由 JSON Schema 表达。

`schema_version="1.0.0"` 表示协议版本；`revision` 是服务端单调递增的场景版本，两者独立。拒绝未知协议版本和未知结构字段；扩展信息只能放 metadata。SceneModel 不包含密码、客户联系方式或可决定权限的 merchant_id。

SceneRecord 是数据库里的场景容器，避免与协议类 SceneModel 同名；关联 merchant_id/project_id。SceneVersion 保存完整且不可变的 SceneModel JSONB、revision、schema_version、created_by、created_at，唯一键 `(scene_id, revision)`。后续保存接口用 expected_revision 做乐观锁，冲突返回 409；Phase 1 只定义此契约，不声称已提供编辑/版本 API。

### 5.2 单位与坐标

- 所有长度统一 mm，允许有限浮点数，拒绝 NaN/Infinity；面积若存储则字段显式为 area_mm2。
- 右手坐标系：XY 为楼层平面，Z 向上；从 +Z 俯视，正旋转为逆时针。
- 平面点 `{x,y}`；空间点 `{x,y,z}`。各楼层共享 XY 原点；楼层 elevation_mm 是相对建筑原点的 Z。
- 楼层内对象的 Z 相对本层地面。真实高度为 floor.elevation_mm + local.z。
- 家具 rotation_deg 是围绕 +Z 的角度，范围 `[0,360)`；尺寸为局部 X 宽、Y 深、Z 高，位置为底面中心；不允许负尺寸或隐含缩放。
- Unity 的轴向、手性与 mm→m 转换集中在未来客户端适配器中；本期只规定轴映射 `(X,Y,Z) → (X,Z,Y)/1000`，旋转需经基向量转换，不能直接复制角度。

### 5.3 对象定义

所有对象 id 为 UUID，在同一场景内全局唯一。除 Floor 外，每个对象必须有 floor_id；所有引用必须能在当前快照中解析。metadata 为 JSON 对象，不能绕开已定义字段的约束。

| 对象 | 必需字段及约束 |
| --- | --- |
| SceneModel | schema_version、scene_id、units 固定 mm、coordinate_system 固定 RH_Z_UP、floors；所有对象集合及 metadata 默认空 |
| Floor | id、name、elevation_mm、height_mm>0；至少一个楼层 |
| Room | id、floor_id、name、boundary；至少三个不同点，无重复闭合点，隐式闭合、非零面积、简单多边形、外环逆时针；v1 不支持内孔 |
| Wall | id、floor_id、start、end、thickness_mm>0、height_mm>0；起终点不能相同；start/end 表示墙中心线 |
| Door | id、floor_id、wall_id、offset_mm>=0、width_mm>0、height_mm>0、sill_height_mm>=0、hinge(start/end)、opens_to(left/right) |
| Window | id、floor_id、wall_id、offset_mm>=0、width_mm>0、height_mm>0、sill_height_mm>=0 |
| Column | id、floor_id、position、width_mm>0、depth_mm>0、height_mm>0、rotation_deg |
| Beam | id、floor_id、start/end 空间点、width_mm>0、height_mm>0；端点不同，中心线标高明示 |
| ElectricalPoint | id、floor_id、position、kind(power/data/switch/other)、可选 wall_id、metadata |
| PlumbingPoint | id、floor_id、position、kind(cold_water/hot_water/drain/gas/other)、可选 wall_id、metadata |
| FurnitureInstance | id、floor_id、可选 room_id、product_id、position、rotation_deg、width_mm/depth_mm/height_mm>0、可选 asset_id、metadata |

门窗 offset_mm 从墙 start 沿墙线量至洞口近端。要求 offset+width <= 墙长，sill+height <= 墙高；门窗与墙的 floor_id 一致。hinge 指洞口近 start 或 end 侧；opens_to 指沿墙 start→end 看向的左/右半平面。家具 room_id 与对象楼层必须一致。允许家具未分配房间；协议不声称检查家具是否真的位于房间内。

几何容差统一为 0.001 mm；JSON 不自动调整坐标、不自动闭合错误轮廓。墙相交、洞口重叠、家具碰撞、通道宽度和水电合理性属于未来 ValidationEngine。

product_id/asset_id 是外部目录引用：离线协议只检查 UUID 形状，未来保存边界必须核验当前商家商品/资源存在；不能将离线协议验证当作租户授权。家具尺寸存快照，商品更新不能偷偷改变已保存方案。

### 5.4 最小交换示例

```json
{
  "schema_version": "1.0.0",
  "scene_id": "10000000-0000-4000-8000-000000000001",
  "units": "mm",
  "coordinate_system": "RH_Z_UP",
  "floors": [{"id":"10000000-0000-4000-8000-000000000002","name":"一层","elevation_mm":0,"height_mm":2800}],
  "rooms": [],
  "walls": [{"id":"10000000-0000-4000-8000-000000000003","floor_id":"10000000-0000-4000-8000-000000000002","start":{"x":0,"y":0},"end":{"x":4200,"y":0},"thickness_mm":200,"height_mm":2800}],
  "doors": [], "windows": [], "columns": [], "beams": [],
  "electrical_points": [], "plumbing_points": [], "furniture_instances": [],
  "metadata": {}
}
```

实施时额外提供含房间、门窗、梁柱、水电和家具的完整例子，以及重复 ID、悬空引用、越界洞口、非法轮廓等反例测试。

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
| SceneRecord | merchant_id、project_id、可选 floor_plan_id、current_revision |
| SceneVersion | merchant_id、scene_id、revision、schema_version、payload JSONB、created_by、created_at |
| FurnitureInstance | 未来按 SceneVersion 投影建立 merchant_id、scene_version_id、instance_id、product_id；快照仍是场景权威来源，禁止独立双写 |
| Quotation / Item | merchant_id、project_id、scene_version_id、status、currency、total；子项存名称/SKU/数量/单价/金额快照及 product_id |
| Order / Item | merchant_id、quotation_id、customer_id、status；订单项独立价格快照，不随商品调价变化 |
| RenderJob | merchant_id、scene_version_id、status、output_object_key、error_code、created_at |

Merchant 不带 merchant_id。未来子表同样保留 merchant_id 并用复合外键约束；删除采用 restrict，Phase 1 不提供删除。

## 7. 认证、初始化与 API

不提供公开创建商家接口。运维命令 `python -m smart_home.cli bootstrap --merchant-name 门店 --email owner@example.com` 以 getpass 交互读取密码，在单一事务创建商家和 owner，输出 merchant UUID。重复账号初始化明确报错，不改写已有密码。owner 通过 `POST /users` 创建本商家销售用户；GET /users/{id} 仅限 owner 且本租户，用于验收。密码最少 12 字符、最多 128 字符，Argon2id 哈希。

`POST /auth/login` 接收 merchant_id、email、password，返回 bearer access_token/expires_in；JWT HS256、有效期 30 分钟、校验 exp/iss/aud，密钥由环境注入且至少 32 字符。`GET /auth/me` 重新查询有效用户及其商家，不信任请求体或 JWT 中的自报角色。失活用户拒绝访问；无刷新令牌时到期重新登录。未知用户/商家/密码错误返回相同 401，未知用户执行哑哈希验证，避免明显计时差。

`GET /health` → `{"status":"ok"}` 为存活检查；`GET /ready` 执行 SELECT 1，数据库不可达返回 503，不能用 health 冒充数据库健康。

| 资源 | 创建 | 列表 | 详情 | 更新 |
| --- | --- | --- | --- | --- |
| customers | POST /customers | GET /customers | GET /customers/{id} | PATCH /customers/{id} |
| products | POST /products | GET /products | GET /products/{id} | PATCH /products/{id} |
| projects | POST /projects | GET /projects | GET /projects/{id} | PATCH /projects/{id} |

创建 201；查询/更新 200；列表 `{items,total,limit,offset}`，默认 limit=20，1..100，offset>=0，按 created_at/id 稳定排序。非本商家 ID 与不存在 ID 均 404。创建/更新引用其他商家的客户或用户时返回 404。唯一性冲突 409；格式或领域值不合法 422；未认证 401；权限不足 403。

租户只能来自认证依赖。Create/Patch 模型禁止 merchant_id、id、password_hash 等越权字段；Patch 区分未提供与显式 null，必填列不能 null。Customer owner 默认当前用户、Project sales user 默认当前用户；显式转交仅 owner 可执行且目标用户属于本商家。销售人员本期可操作本商家全部客户、商品、项目，不额外引入个人数据域。

错误响应采用 `{error:{code,message,details}}`，details 不回显 password/token 或原始数据库错误。Swagger `/docs` 与 `/openapi.json` 可用，安全方案支持输入 bearer token，包含独立读写 schema。

## 8. 存储边界

`ObjectStorageProvider` Protocol 提供 `put(key: str, data: bytes, content_type: str) -> None`、`read(key: str) -> bytes`、`delete(key: str) -> None`。Local 实现限定在配置目录内，拒绝绝对路径、..、Windows 盘符/反斜线以及指向根目录外的符号链接。对象 key 为 `merchants/{merchant_id}/{uuid}`，由服务端生成。

本期只交付接口和有实文件读写测试的 Local 实现；不暴露上传 API、不接 MinIO。未来 OSS/COS/MinIO 实现同接口，临时签名 URL 作为独立能力，不把本地路径存进业务数据。

## 9. 交付与验证

Compose 包含 PostgreSQL 16 和 API，数据库健康检查、持久卷、API 环境变量。迁移是显式一次性命令，不用 create_all 替代 Alembic；API 不自行建表。配置 `.env.example` 含 DATABASE_URL、SECRET_KEY、ENVIRONMENT；秘密值留空，README 教用户本地生成，禁止真实密码入库。

pytest 集成测试必须用独立的真实 PostgreSQL 测试库，执行迁移，不以 SQLite/mock 替代。测试覆盖认证及失活/过期/伪造 token，所有资源 CRUD、分页、PATCH null、唯一冲突、A/B 商家读取/修改/引用/字段注入隔离、数据库复合外键和回滚、SceneModel 正反例、Local 存储越界。

CI 使用 PostgreSQL service，安装锁定依赖，执行 Ruff check、Ruff format --check、Alembic upgrade head、pytest、协议导出一致性检查、OpenAPI 导出一致性检查。契约生成不访问数据库。

验收必须在干净环境走完：安装 → PostgreSQL → migration → bootstrap 商家和 owner → 登录 → 创建用户 → 客户/商品/项目 → 列表和详情 → Swagger → 完整测试。README 记录 Bash/PowerShell 均可用命令。未运行的检查要明确标为未验证，不能宣称 Phase 1 完成。

## 10. 后续阶段

Phase 1 验收后先实现 SceneVersion 保存/并发控制和最小 Unity 协议消费验证，再制定户型导入计划；每期独立设计评审。不在本次预设 Phase 2/3 已获实施授权。
