# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可验证的多商家业务后端和统一 SceneModel 协议。

**Architecture:** Modular Monolith，关系表保存业务数据，SceneModel 使用独立 Pydantic 包。场景持久化版本、Unity 和解析器仅设计，不在本期实现。

**Tech Stack:** Python 3.12、FastAPI、Pydantic 2、SQLAlchemy 2.x、Alembic、PostgreSQL 16、psycopg 3、pytest、Ruff。

**Spec:** `docs/superpowers/specs/2026-09-17-smart-home-mvp-design.md`

状态：用户已授权恢复实施。实现进度、TDD 证据和阻塞事项见 [执行记录](2026-09-17-phase-1-progress.md)。下列清单保留原验收要求；不能把代码已写入或部分测试通过当作任务完整验收。

## Global Constraints

- 当前仅 Phase 1，不创建新 GitHub 仓库、不引入 Next.js/Unity/解析/渲染业务。
- 所有长度统一 mm；右手坐标系，XY 平面、Z 向上。
- 租户范围只来自认证；关联用 merchant_id 复合外键；金额 Decimal。
- 真实 PostgreSQL 测试，不用 SQLite 或 mock 宣称数据库验收完成。
- 每个任务先失败测试 → 最小实现 → 通过测试 → 小步 commit；失败原因必须是目标行为缺失，不能以依赖缺失作为业务红灯证据。
- 测试命令在仓库根目录、已激活 Python 3.12 虚拟环境中执行；DATABASE_URL 指开发库，TEST_DATABASE_URL 指独立测试库。
- 禁止真实密码/密钥入库，不删除失败测试，不生成大量空目录。

## Task 1: 可运行 API 与测试工具链

**Create:** `pyproject.toml`、`requirements.lock`、`.gitignore`、`apps/api/src/smart_home/__init__.py`、`apps/api/src/smart_home/main.py`、`tests/test_health.py`。

**Interfaces:** `create_app() -> FastAPI`；模块导出 `app`；GET /health。

- [ ] 确认 Python 3.12 与 pip 可用；虚拟环境中安装 FastAPI/httpx/pytest/Ruff，生成可复现依赖锁。检查已有仓库 remote 后关联目标 URL，建立 codex/phase-1-foundation；解决当前 Git HTTPS helper 缺失。
- [ ] 写测试并运行 `python -m pytest tests/test_health.py -v`，记录目标导入/路由缺失的失败。

```python
from fastapi.testclient import TestClient
from smart_home.main import create_app

def test_health():
    with TestClient(create_app()) as client:
        assert client.get('/health').json() == {'status': 'ok'}
        assert client.get('/health').status_code == 200
```

- [ ] 实现应用工厂和无数据库依赖的 health；配置 setuptools src 发现与 pytest 路径。

```python
from fastapi import FastAPI

def create_app() -> FastAPI:
    app = FastAPI(title='智能家居 API')
    @app.get('/health')
    def health() -> dict[str, str]:
        return {'status': 'ok'}
    return app

app = create_app()
```

- [ ] 重跑 health 测试与 `python -m ruff check .`、`python -m ruff format --check .`。
- [ ] 验收：全新虚拟环境可安装，health 200。Commit：`feat: initialize FastAPI foundation`。

## Task 2: SceneModel 结构、几何及引用协议

**Create:** `packages/scene-schema/pyproject.toml`、`packages/scene-schema/src/scene_schema/{__init__,geometry,elements,scene,export}.py`、`packages/scene-schema/scene.schema.json`、`packages/scene-schema/examples/apartment.json`、`tests/scene/{test_geometry,test_scene,test_export}.py`。

**Modify:** 根 `pyproject.toml`、依赖锁。

**Interfaces:** `SceneModel.model_validate(payload) -> SceneModel`；`SceneModel.model_json_schema() -> dict`；`python -m scene_schema.export --check` 比较已提交 schema。

- [ ] 写尺寸与引用反例，fixture 从完整 apartment.json 独立深拷贝。

```python
import pytest
from pydantic import ValidationError
from scene_schema import SceneModel

def test_rejects_zero_wall(apartment):
    apartment['walls'][0]['end'] = apartment['walls'][0]['start'].copy()
    with pytest.raises(ValidationError):
        SceneModel.model_validate(apartment)

def test_rejects_dangling_wall(apartment):
    apartment['doors'][0]['wall_id'] = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    with pytest.raises(ValidationError):
        SceneModel.model_validate(apartment)

def test_round_trip(apartment):
    scene = SceneModel.model_validate(apartment)
    assert SceneModel.model_validate_json(scene.model_dump_json()) == scene
```

- [ ] 运行 `python -m pytest tests/scene -v` 并记录红灯。
- [ ] 按设计第 5 节拆分 Point2/Point3、各元素、SceneModel；有限数与正尺寸使用 Pydantic 约束；统一 extra='forbid'。scene 的 model_validator 建立 ID 索引，检查重复/悬空引用/跨层引用/洞口范围。geometry 检查非零边长、轮廓面积、非相邻线段相交；容差 0.001 mm。
- [ ] 增加 NaN/Infinity、错误 units/schema_version、负尺寸、错误角度、自交/顺时针/重复点轮廓、重复 ID、跨楼层门窗、家具 room_id、越界洞口、metadata 序列化和所有元素的正例测试。
- [ ] 实现 schema 导出入口，以 UTF-8、排序 JSON 输出；`--check` 不写文件，差异时退出非零。
- [ ] 运行 `python -m pytest tests/scene -v`、`python -m scene_schema.export --check`。
- [ ] 验收：完整例子往返保真，所有非法输入拒绝，schema 与模型同步。Commit：`feat: define versioned millimeter SceneModel contract`。

## Task 3: 数据库、五个核心实体与迁移

**Create:** `apps/api/src/smart_home/{config,db}.py`、`apps/api/src/smart_home/modules/{merchants,users,customers,products,projects}/models.py`、`apps/api/alembic.ini`、`apps/api/alembic/env.py`、`apps/api/alembic/versions/0001_business_foundation.py`、`.env.example`、`docker-compose.yml`、`tests/conftest.py`、`tests/test_database.py`、`tests/test_merchants.py`。

**Modify:** `pyproject.toml`、依赖锁、`main.py`。

**Interfaces:** `Settings` 从环境读取 DATABASE_URL/SECRET_KEY/ENVIRONMENT；`Base` 是 DeclarativeBase；`get_session() -> Iterator[Session]`；Merchant/User/Customer/Product/DesignProject 模型字段按设计第 6 节。

- [ ] Compose 先加入 PostgreSQL healthcheck 和独立测试数据库初始化步骤；测试 fixture 从 TEST_DATABASE_URL 建 engine，拒绝与 DATABASE_URL 相同的地址，并执行 Alembic；禁止误清开发库。
- [ ] 写真实连接、迁移、Decimal 往返、唯一约束与复合外键测试。

```python
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import pytest

def test_database_connection(db_session):
    assert db_session.execute(text('select 1')).scalar_one() == 1

def test_customer_cannot_reference_other_merchant_user(db_session, tenants):
    from smart_home.modules.customers.models import Customer
    a, b = tenants
    db_session.add(Customer(merchant_id=a.merchant_id, owner_user_id=b.id, name='越界'))
    with pytest.raises(IntegrityError):
        db_session.flush()
```

- [ ] `python -m pytest tests/test_database.py tests/test_merchants.py -v`，记录表或约束缺失的红灯。
- [ ] 实现完整字段、外键/唯一键/索引、UTC 时间及 updated_at 更新；金额 Numeric(12,2)；migration 显式创建/删除各表，应用不调用 create_all。
- [ ] 增加 /ready 数据库检查；失败返回 503 且不泄漏连接信息。
- [ ] 空测试库执行 `python -m alembic -c apps/api/alembic.ini upgrade head`，测试库 downgrade base 再 upgrade head，执行上述 pytest。
- [ ] 验收：实际 PostgreSQL 约束生效、迁移可往返、五个模型字段完整。Commit：`feat: add tenant-aware PostgreSQL foundation`。

## Task 4: Bootstrap、认证与用户

**Create:** `apps/api/src/smart_home/cli.py`、`apps/api/src/smart_home/modules/auth/{security,schemas,dependencies,router}.py`、`apps/api/src/smart_home/modules/users/{schemas,router}.py`、`tests/{test_bootstrap,test_auth,test_users}.py`。

**Modify:** `main.py`、`config.py`、`tests/conftest.py`、依赖锁。

**Interfaces:** `hash_password(str)->str`、`verify_password(str,str)->bool`、`get_current_user()->User`（FastAPI 依赖）；login/me、POST /users、GET /users/{id}；bootstrap CLI 按设计第 7 节。

- [ ] 测试 fixture 在数据库建 A/B 商家，实际使用密码哈希和 login 获取 token，不覆盖认证依赖。

```python
def test_login_and_me(client, owner):
    response = client.post('/auth/login', json={
        'merchant_id': str(owner.merchant_id),
        'email': owner.email, 'password': 'Test-Password-1234'})
    assert response.status_code == 200
    token = response.json()['access_token']
    me = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.json()['id'] == str(owner.id)
    assert 'password_hash' not in me.json()
```

- [ ] 运行 `python -m pytest tests/test_bootstrap.py tests/test_auth.py tests/test_users.py -v`，记录缺失功能失败。
- [ ] 实现 Argon2id、JWT exp/iss/aud/算法验证、每请求检查用户激活状态。bootstrap 用 getpass、单事务、重复时报错。owner 创建用户时强制本商家，sales 禁止调用。
- [ ] 测试错误密码、未知商家/用户、过期/篡改 token、禁用账号、越权用户创建、密码长度及错误响应不含密码。确认数据库不存明文，登录响应不含哈希。
- [ ] 重跑上述测试。验收：首次商家到登录完整可用。Commit：`feat: add secure merchant onboarding and authentication`。

## Task 5: Customer CRUD 与租户隔离

**Create:** `apps/api/src/smart_home/modules/customers/{schemas,service,router}.py`、`apps/api/src/smart_home/errors.py`、`tests/test_customers.py`、`tests/test_isolation.py`。

**Modify:** `main.py`、`tests/conftest.py`。

**Interfaces:** POST/GET /customers、GET/PATCH /customers/{id}；独立 CustomerCreate/CustomerPatch/CustomerRead；统一 ErrorResponse。

- [ ] 写实际登录后的创建、读取、分页、更新测试；A/B token fixture 通过 Task 4 登录入口获得。

```python
def test_customer_isolation(client, auth_a, auth_b):
    created = client.post('/customers', headers=auth_a, json={'name': '张先生'})
    assert created.status_code == 201
    customer_id = created.json()['id']
    assert client.get(f'/customers/{customer_id}', headers=auth_b).status_code == 404
    assert client.patch(f'/customers/{customer_id}', headers=auth_b,
                        json={'name': '越权'}).status_code == 404
    assert client.get('/customers', headers=auth_b).json()['total'] == 0
```

- [ ] `python -m pytest tests/test_customers.py tests/test_isolation.py -v` 验证红灯。
- [ ] 服务层每条查询显式 merchant_id 过滤，先查本租户对象再改；创建 owner 默认当前用户。Patch 使用 model_dump(exclude_unset=True)，必填字段 null 拒绝。仅 owner 能转交归属，并验证目标用户商家。
- [ ] 覆盖完整字段、预算负数、分页边界、null、字段注入、跨商家 owner_id；details 去除验证错误的敏感 input。
- [ ] 重跑上述测试；验收：A 无法读取或修改 B，包括按关联 ID 绕过。Commit：`feat: add tenant-isolated customer APIs`。

## Task 6: Product CRUD

**Create:** `apps/api/src/smart_home/modules/products/{schemas,service,router}.py`、`tests/test_products.py`。

**Modify:** `main.py`、`tests/test_isolation.py`。

**Interfaces:** POST/GET /products、GET/PATCH /products/{id}；价格为 Decimal，metadata 映射 ORM product_metadata。

```python
def test_product_price_and_dimensions(client, auth_a):
    payload = {'name':'冰箱', 'category':'appliance', 'brand':'示例',
               'sku':'FRIDGE-01', 'price':'3999.90',
               'width_mm':600, 'depth_mm':650, 'height_mm':1800}
    response = client.post('/products', headers=auth_a, json=payload)
    assert response.status_code == 201
    assert response.json()['price'] == '3999.90'
    payload['width_mm'] = 0
    assert client.post('/products', headers=auth_a, json=payload).status_code == 422
```

- [ ] 先写上述测试及 CRUD、租户隔离、同租户 SKU 冲突测试。
- [ ] `python -m pytest tests/test_products.py tests/test_isolation.py -v` 验证红灯。
- [ ] 实现尺寸正值、价格非负、SKU 租户唯一、metadata 往返、thumbnail/model_url 可选；唯一冲突转 409 并回滚事务。
- [ ] 增加不同租户相同 SKU 成功、跨租户 PATCH 404、null 必填字段拒绝及未知字段拒绝测试。
- [ ] 重跑上述测试。验收：金额精确往返、隔离覆盖所有操作。Commit：`feat: add tenant-isolated product catalog APIs`。

## Task 7: DesignProject CRUD

**Create:** `apps/api/src/smart_home/modules/projects/{schemas,service,router}.py`、`tests/test_projects.py`。

**Modify:** `main.py`、`tests/test_isolation.py`。

**Interfaces:** POST/GET /projects、GET/PATCH /projects/{id}；创建要求本商家 customer_id，sales_user_id 默认当前用户。

```python
def test_project_rejects_cross_tenant_customer(client, auth_a, customer_b):
    response = client.post('/projects', headers=auth_a, json={
        'name':'新房方案', 'customer_id':str(customer_b.id)})
    assert response.status_code == 404
```

- [ ] 写 CRUD、上例、跨租户 sales_user_id、更新重绑 customer_id、无认证和 merchant_id 注入测试。
- [ ] `python -m pytest tests/test_projects.py tests/test_isolation.py -v` 确认红灯。
- [ ] 实现事务内租户关联检查、状态枚举、列表分页、更新时间与转交权限；数据库外键作为第二层保护。
- [ ] 重跑上述测试；确认失败请求没有插入半条项目。验收：项目始终绑定本商家客户及销售。Commit：`feat: add tenant-isolated design project APIs`。

## Task 8: Local ObjectStorageProvider

**Create:** `apps/api/src/smart_home/storage/{__init__,base,local}.py`、`tests/test_storage.py`。

**Interfaces:** `ObjectStorageProvider` 的 put/read/delete 签名按设计第 8 节；`LocalObjectStorage(root: Path)` 实现。

```python
import pytest
from smart_home.storage.local import LocalObjectStorage

def test_local_round_trip(tmp_path):
    storage = LocalObjectStorage(tmp_path)
    storage.put('merchants/a/example', b'asset', 'application/octet-stream')
    assert storage.read('merchants/a/example') == b'asset'
    storage.delete('merchants/a/example')
    with pytest.raises(FileNotFoundError):
        storage.read('merchants/a/example')
```

- [ ] 加上 `../escape`、绝对路径、Windows 盘符/反斜线、空 key 与根外 symlink 用例。
- [ ] `python -m pytest tests/test_storage.py -v` 确认失败。
- [ ] 实现 Protocol 与实际磁盘读写；规范化并检查路径包含关系；Local 存储根不允许不可信用户修改，symlink 测试在 Linux CI 必须运行。
- [ ] 重跑测试。验收：真实文件往返、越界拒绝。Commit：`feat: add local object storage abstraction`。

## Task 9: OpenAPI、Docker、CI 和完整验收

**Create:** `infra/docker/api.Dockerfile`、`packages/api-contracts/export.py`、`packages/api-contracts/openapi.json`、`.github/workflows/ci.yml`、`README.md`、`docs/architecture/{data-model,scene-model}.md`、`tests/{test_openapi,test_acceptance}.py`。

**Modify:** `docker-compose.yml`、`.env.example`、依赖锁。

**Interfaces:** Docker API 监听 8000；/docs、/openapi.json；契约脚本 `python packages/api-contracts/export.py --check`。

```python
def test_openapi_documents_auth_and_resources(client):
    assert client.get('/docs').status_code == 200
    schema = client.get('/openapi.json').json()
    for path in ['/health', '/auth/login', '/auth/me', '/customers', '/products', '/projects']:
        assert path in schema['paths']
    assert schema['components']['securitySchemes']
```

- [ ] 先写上例及 bootstrap→登录→创建用户→客户→商品→项目→查询的真实数据库端到端测试，不覆盖认证/数据库依赖。
- [ ] `python -m pytest tests/test_openapi.py tests/test_acceptance.py -v`，确认新增验收条件失败。
- [ ] Dockerfile 安装锁定依赖，以非 root 用户运行；Compose 完善 API、DB readiness、环境注入及数据库卷。显式运行 migration 后再启动 API。
- [ ] 导出 OpenAPI，与 Scene schema 采用同样的只读 --check 模式。
- [ ] CI PostgreSQL service 上依次运行：Ruff check、format check、迁移、完整 pytest、两项契约检查。CI 临时密钥从运行时随机产生。
- [ ] README 写完整本地/Compose 命令、生成密钥、开发/测试分库、migration、bootstrap 交互输入、login JSON、Bearer Swagger、CRUD 示例和测试；说明 Docker 容器 URL 与宿主机 URL 区别。数据字典明确未来实体尚未建表。
- [ ] 实际运行以下命令，记录退出码和测试计数：

```text
python -m ruff check .
python -m ruff format --check .
python -m alembic -c apps/api/alembic.ini upgrade head
python -m pytest -v
python -m scene_schema.export --check
python packages/api-contracts/export.py --check
docker compose config --quiet
docker compose build api
```

- [ ] 按 README 从干净数据库逐步 smoke test，实际访问 /health、/ready、/docs 及三类资源。审查 git diff 和秘密文件，提交 `ci: verify Phase 1 backend and document onboarding`。
- [ ] 验收：全部十五条用户验收步骤有实际证据；环境缺失导致任何检查未跑时，明确列为未完成，不宣称 Phase 1 完成。

## 执行记录要求

每完成一个任务记录红灯原因、绿灯命令与结果、commit SHA。实际进度与红绿灯证据见 [执行记录](2026-09-17-phase-1-progress.md)；本计划的原始步骤保留供核对，设计稿提交不等于实现提交。完成前使用 verification-before-completion 和 requesting-code-review 工作流，再决定推送及集成方式。
