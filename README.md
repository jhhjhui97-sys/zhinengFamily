# zhinengFamily 智能家居

面向家具/家电门店的 AI + 3D 设计与销售系统。本次开发范围为 Phase 1：业务后端和统一 SceneModel 协议。

当前代码包含五个核心数据库实体、登录认证、客户/商品/项目 CRUD、SceneModel、Local 存储接口及交付配置。Linux CI 全量验证为 **290 passed, 2 warnings**；Ruff、Alembic migration、SceneModel/OpenAPI 契约检查和 Docker build 均通过，Phase 1 已通过复审。详细证据见 [执行记录](docs/superpowers/plans/2026-09-17-phase-1-progress.md)。没有 Unity、户型解析、AI 摆放或渲染实现。

## 环境要求

后台前端骨架位于 [`apps/admin-web`](apps/admin-web/README.md)。在该目录运行 `npm install` 和 `npm run dev`，打开 http://localhost:3000。当前仅提供中文页面与后台布局预览，尚未接入认证和业务 API；下文为 Phase 1 后端启动说明。

- Python 3.12（Windows、Linux 或 macOS）。Windows 安装可执行的 Python，而不是 WindowsApps 商店别名。
- PostgreSQL 16；推荐 Docker Desktop/Engine 和 Compose v2 启动数据库。
- Git。默认 API 端口 8000，开发 PostgreSQL 端口 5432。
- Windows 原生 PostgreSQL 若在中文路径初始化报 UTF-8 错误，请将数据库程序和数据目录放到 ASCII 路径，或使用 Docker；应用仓库可以保留中文路径。

## 安装

```text
git clone https://github.com/jhhjhui97-sys/zhinengFamily.git
cd zhinengFamily
python -m venv .venv
```

PowerShell 激活：`.\.venv\Scripts\Activate.ps1`。Bash 激活：`source .venv/bin/activate`。若 PowerShell 策略禁止激活，可以将下文 `python` 换成 `.\.venv\Scripts\python.exe`，无需修改系统执行策略。

```text
python -m pip install -r requirements.lock
python -m pip install --no-deps -e .
```

`requirements.lock` 固定运行和开发依赖版本；editable 安装让 API 和 scene_schema 都可导入。构建工具 setuptools 由 pyproject.toml 的隔离构建声明安装。

## 配置环境

PowerShell：`Copy-Item .env.example .env`。Bash：`cp .env.example .env`。

分别运行两次以下命令，生成数据库密码和 JWT 密钥；把不同结果填入 `.env`。不要把 `.env` 提交 Git。

```text
python -c "import secrets; print(secrets.token_hex(32))"
```

设置：

```dotenv
POSTGRES_USER=smart_home
POSTGRES_PASSWORD=<第一次生成的十六进制值>
POSTGRES_DB=smart_home_dev
DATABASE_URL=postgresql+psycopg://smart_home:<同一数据库密码>@127.0.0.1:5432/smart_home_dev
TEST_DATABASE_URL=postgresql+psycopg://smart_home:<同一数据库密码>@127.0.0.1:5432/smart_home_test
SECRET_KEY=<第二次生成的十六进制值，至少32字符>
ENVIRONMENT=development
```

尖括号内容必须替换。建议使用生成的十六进制密码，避免连接 URL 特殊字符转义问题。进程环境变量优先于 `.env`；原生开发和 Compose 的数据库主机名不同：宿主机使用 `127.0.0.1`，API 容器使用 `db`（Compose 自动配置）。

## 启动 PostgreSQL 和迁移

```text
docker compose up -d db
docker compose exec db pg_isready -U smart_home -d smart_home_dev
python -m alembic -c apps/api/alembic.ini upgrade head
```

若使用原生 PostgreSQL，自行创建专用登录角色及其拥有的 `smart_home_dev`、`smart_home_test` 两个数据库，填写相应 URL，然后执行同一个迁移命令。生产服务不需要数据库超级用户权限。

迁移只创建 Merchant、User、Customer、Product、DesignProject 对应五张业务表；不使用 create_all，也不会在 API 启动时自动修改数据库。

## 创建商家与账号

```text
python -m smart_home.cli bootstrap --merchant-name "示例家具门店" --email owner@example.com
```

按交互提示输入两次 12–128 字符的密码，不要把密码放到命令参数。成功输出 `merchant_id` 和 `user_id`，保存商家 ID 用于登录。命令在单一事务建立商家和 owner；相同商家名重复初始化会拒绝，不覆盖已有密码。商家名相同的独立门店请附加门店标识。

没有公开商家注册 API。owner 可登录后用 `POST /users` 创建本商家的 owner 或 sales 用户；销售用户不能创建用户。

## 启动 API 与 Swagger

```text
python -m uvicorn smart_home.main:app --reload --host 127.0.0.1 --port 8000
```

- [Swagger](http://127.0.0.1:8000/docs)
- [存活检查](http://127.0.0.1:8000/health)：`{"status":"ok"}`
- [数据库就绪检查](http://127.0.0.1:8000/ready)：`{"status":"ready"}`，数据库不可达返回 503。
- [OpenAPI](http://127.0.0.1:8000/openapi.json)

在 Swagger 执行 `POST /auth/login`，请求示例：

```json
{"merchant_id":"替换为初始化输出的UUID","email":"owner@example.com","password":"输入你自己设置的密码"}
```

将返回的 `access_token` 粘贴进 Swagger 的 **Authorize → HTTPBearer**；输入 token 本身。先调用 `GET /auth/me` 验证身份。令牌有效 30 分钟，到期重新登录；每次请求会重新核查账号激活状态。

依次创建：

```text
POST /customers
{"name":"张先生","phone":"13800000000","budget":"80000.00","source":"门店"}

POST /products
{"category":"sofa","brand":"示例","name":"三人沙发","sku":"SOFA-001","price":"3999.90","width_mm":2100,"depth_mm":900,"height_mm":850,"metadata":{"color":"浅灰"}}

POST /projects
{"name":"张先生新房","customer_id":"替换为客户UUID","address":"上海","status":"draft"}
```

三种资源均提供 POST 创建、GET 列表、GET /{id} 详情、PATCH /{id} 更新。列表可传 `limit=20&offset=0`，limit 最大 100。PATCH 未提供字段保持不变；可空字段支持显式 null，必填字段拒绝 null。暂时不提供删除。

所有租户字段由登录用户决定，不能通过请求体设置 merchant_id。其他商家的记录和关联 ID 返回 404。owner 可指定/转交 customer.owner_user_id、project.sales_user_id；销售人员可操作本商家资源，但不能转交归属。金额以十进制字符串返回，尺寸为 mm。请求中的文本（包括密码、元数据字符串和键）拒绝空字符 U+0000，返回不回显原始输入的 422。

## 完整 Docker 启动

在 `.env` 配好密码与密钥后：

```text
docker compose config --quiet
docker compose build api
docker compose up -d db
docker compose run --rm api python -m alembic -c apps/api/alembic.ini upgrade head
docker compose run --rm api python -m smart_home.cli bootstrap --merchant-name "示例家具门店" --email owner@example.com
docker compose up -d api
```

API 镜像以非 root 用户运行。迁移保持显式执行；生产升级前应备份数据库。Compose 数据卷会保留数据，重复启动无需再次 bootstrap。

## 测试

先创建独立测试库（以下按默认数据库用户名）：

```text
docker compose exec db createdb -U smart_home -O smart_home smart_home_test
python -m pytest -v
python -m ruff check .
python -m ruff format --check .
python -m scene_schema.export --check
python packages/api-contracts/export.py --check
```

pytest 从 `.env` 或进程环境读取 TEST_DATABASE_URL/SECRET_KEY。测试库名字必须以 `_test` 结尾，且不能与开发 URL 指向同一主机、端口、数据库。**数据库测试会清空测试表，并执行 downgrade/upgrade 往返，测试 URL 只能指向可丢弃的专用测试库。** 无 TEST_DATABASE_URL 时数据库测试会失败，不会静默跳过或改用 SQLite。

认证、CRUD、商家隔离和端到端测试使用真实 PostgreSQL、实际登录 token，不覆盖数据库或认证依赖。SceneModel 测试还验证自交轮廓、重复 ID、跨层引用、门窗越界、非有限数字、元数据和模型实例绕过。

Windows 创建符号链接可能需要开发者模式或相应权限；缺少权限时仅 symlink 用例会报告 skip，Linux CI 必须运行。受沙箱限制导致 pytest 临时目录不可访问时应修复执行权限后重跑，不能据部分通过宣布完整验收。

GitHub Actions 配置了 PostgreSQL service、lint/format、迁移、pytest、契约一致性和 Docker 构建；只有推送后实际运行绿灯才代表 CI 通过。

## SceneModel 与目录

Pydantic 类型是权威定义，尺寸为 mm，右手坐标 XY 平面/Z 向上。JSON Schema 和 OpenAPI 自动导出。需要更新生成文件时：

```text
python -m scene_schema.export
python packages/api-contracts/export.py
```

OpenAPI 的 SceneModel 组件用于共享协议，当前没有场景保存、版本编辑或转换 API。JSON Schema 校验结构；跨引用、几何规则由 Python 校验器执行，不能把结构通过当作碰撞检测通过。

```text
apps/api/                 FastAPI、业务模块、Alembic
packages/scene-schema/    Pydantic 协议、JSON Schema、完整示例
packages/api-contracts/   OpenAPI 生成脚本及产物
infra/docker/            API Dockerfile
tests/                   协议、数据库、认证、CRUD、隔离、存储和验收测试
docs/architecture/       SceneModel 与数据字典
docs/superpowers/         设计、计划、执行证据
.github/workflows/        CI
```

详细约束见 [总体设计](docs/superpowers/specs/2026-09-17-smart-home-mvp-design.md)、[SceneModel](docs/architecture/scene-model.md)、[数据字典](docs/architecture/data-model.md)。LocalObjectStorage 当前是可替换接口与适配器，没有开放上传路由；商家对象 key 必须由未来业务层生成。
