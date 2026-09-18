# Phase 1 执行记录

计划：`docs/superpowers/plans/2026-09-17-phase-1-foundation.md`。

## 恢复点

- 用户已授权从暂停位置继续，设计评审门槛解除；无需重写设计。
- 原提交 `8b8c239` 只有两份文档，无代码、测试或历史测试结果。
- 恢复时 Git status 的两个文档修改标记无对应内容差异；保留原文件。
- 在当前目录开发，使用 `codex/phase-1-foundation` 分支；按用户继续当前仓库的意图，不另建工作树。
- origin 已指向已有 `jhhjhui97-sys/zhinengFamily`，没有创建 GitHub 仓库。
- 当前 Git 的 HTTPS helper 实际存在于 bundled Git 的 mingw64/bin；设置进程 GIT_EXEC_PATH 后 ls-remote 成功，远端无 refs。
- Python 3.12.14 位于 Codex bundled runtime；WindowsApps 别名不是可用开发解释器。
- 首次 venv ensurepip 因沙箱临时目录写权限失败；使用项目 .local/tmp 并批准联网安装解决。业务 TDD 红灯不能以依赖安装失败替代。

## 任务状态

| 任务 | 状态 | 证据 |
| --- | --- | --- |
| 1 API 工具链 | 已实现并评审 | `1e0afa1`；干净虚拟环境安装、pip check、非 editable wheel 构建通过 |
| 2 SceneModel | 已实现并复审 | 原 160 项协议测试通过；极端坐标回归已通过 |
| 3 PostgreSQL/实体/迁移 | 已实现并复审 | 真实 PostgreSQL 16.15；迁移往返、元数据一致性、复合外键检查通过 |
| 4 认证/用户 | 已实现并复审 | 实际 Argon2id 与 JWT；真实数据库验证 |
| 5 客户 CRUD | 已实现并复审 | 真实数据库、租户隔离、PATCH 语义检查通过 |
| 6 商品 CRUD | 已实现并复审 | Numeric 金额、尺寸、SKU、JSON 元数据检查通过 |
| 7 项目 CRUD | 已实现并复审 | 客户/销售同租户绑定、查询和更新检查通过 |
| 8 本地存储 | Windows 验证通过 | 实际磁盘往返与越界拒绝；3 个 symlink 用例待 Linux |
| 9 Docker/CI/验收 | 部分完成 | 原生 HTTP smoke、干净安装通过；Docker/Linux CI 未运行 |

本文件持续追加执行证据；未完成项不代表已验收。

## Task 1

- RED：依赖完成后，health 测试因 `smart_home` 尚未实现失败。
- GREEN：同一 pytest 命令 1 passed；Ruff check/format 均通过。
- 独立评审：规格符合、代码质量通过；提交 `1e0afa1`。
- 上游 Starlette/AnyIO 两条弃用警告保留，未过滤；无业务失败。
- PostgreSQL 官方包采用 HTTP Range 只读提取 bin/share/必要 DLL，下载范围从 333 MB 缩减为 45 MiB，仍由 ZIP CRC 校验。

## 2026-09-18 后续任务与 TDD 证据

### SceneModel

- 首个缺失协议测试失败；最小未验证模型上 12 个几何/引用反例报 DID NOT RAISE，完整红灯 153 failed / 5 passed。
- 补齐约束后 158 passed；复审模型实例输入发现 Point3 可进入 Point2 字段，以及可变模型实例绕过有限数校验。新增两个反例先失败，再启用 revalidate_instances='always'，最终 160 passed。
- Schema draft 2020-12、全部元素、mm/坐标规则、唯一 ID、同楼层引用、门窗范围、简单逆时针轮廓、递归有限 JSON、独立完整示例均已实现。
- SceneVersion 持久化/保存 API 没有实现，仍属后续阶段；schema_version 与 revision 的职责没有混用。

### 数据库与认证

- PostgreSQL 在中文路径 initdb 出现非法 UTF-8 字节，改用已授权 ASCII 工作区后成功；数据库仅监听 127.0.0.1:55432，不是 Windows 系统服务。
- 两个独立数据库 smart_home_dev/smart_home_test；业务连接使用非超级用户角色；凭据仅存在忽略目录，不进入 Git。
- 数据库红灯：五张核心表集合断言失败（实际表集为空）；生成并检查固定 Alembic 迁移后，数据库/商家/health 共 20 passed，包括 downgrade/upgrade、元数据一致性、Decimal 往返和跨商家复合外键。
- 认证红灯：缺失登录路由及 bootstrap，14 failed；实现后同组 14 passed。
- 认证采用 Argon2id、HS256 JWT、30 分钟过期、iss/aud/exp/sub 校验、每请求重查激活状态；未知账号执行哑哈希验证。账号输出与错误不回显密码。

### CRUD 与交付

- 三组 CRUD 预先测试得到 21 failed（路由缺失）；逐个实现后 Customer 9、Product 11、Project 1 passed。
- 增补字段注入、销售归属转交限制、非有限元数据与真实数据库不可达检查：6 passed。
- OpenAPI 的共享 SceneModel 和导出程序两个测试先失败，补齐后与端到端用例合计 3 passed。
- 端到端用例真实执行 bootstrap → 登录 → 创建销售用户 → 客户/商品/项目 → 查询，无认证或数据库 mock/依赖替换。
- 完整测试首次暴露 tests/scene/conftest.py 与 tests/conftest.py 的导入名冲突。辅助函数移到 tests/db_support.py 后，在同时收集两处测试的 170 项检查中通过。
- 已写 README、Compose PostgreSQL/API、Dockerfile、GitHub Actions、数据字典及生成契约；没有创建空前端/Unity/微服务目录。

## 历史检查：额度耗尽前（已由恢复后的验证取代）

| 检查 | 结果 |
| --- | --- |
| `python -m pytest -q --tb=line` | **222 passed, 48 errors, 4 warnings，退出 1** |
| 48 个 setup errors | 46 个存储测试 + 2 个 Scene Schema 文件输出测试，均为 pytest 临时目录 WinError 5 |
| 业务断言失败 | 修复测试辅助模块冲突后，本次最终运行没有 assertion failure；环境错误仍使全量检查失败 |
| `python -m ruff check .` | All checks passed |
| `python -m ruff format --check .` | 66 files already formatted |
| `python -m scene_schema.export --check` | 退出 0 |
| `python packages/api-contracts/export.py --check` | 退出 0，无数据库连接需求 |
| 开发库 migration | upgrade head 退出 0 |
| 实际 Uvicorn HTTP smoke | /health、/ready、/docs、/openapi.json 全部 200；health=ok，ready=ready |
| Docker build / Compose runtime | 未运行；当前 PATH 无 docker |
| 全新环境 editable 安装 | 未完成；当前测试使用项目虚拟环境和 src 路径 |
| GitHub CI | 未推送，未运行 |
| 独立代码复审 | Task 1 通过；后续复审被代理额度限制中断，不能称已通过 |

保留的警告：两条上游 Starlette/AnyIO 弃用警告及 pytest cache 权限警告；没有通过过滤警告或删除测试掩盖问题。

## 历史权限阻塞（额度恢复后已解除）

自动审批返回：`Automatic approval review failed: You've hit your usage limit ... try again at 2:50 AM`。随后两个子代理也因额度限制终止。不是已确认的代码危险行为，但不能绕过审批。

审批被拒绝的是带权限提升的存储测试/格式命令。安全替代是在当前沙箱执行允许的数据库、API、纯协议与只读检查；需要临时目录写权限的测试仍被阻止。本地 `.git` 也属于只读保护范围，因此后续暂存/提交需要恢复审批能力。

已提交：`8b8c239`（设计）、`1e0afa1`（FastAPI 基础）。其余实现保留在当前工作区，**未提交、未推送**。不要用当前未提交规模推断它已完成验收。

## 恢复计划

1. 恢复本任务必要的执行/审批权限，重跑完整 pytest；修复任何真实失败，不降低测试要求。
2. 验证干净 Python 环境的依赖和 editable 安装；有 Docker 的环境执行 Compose config/build/start 及 README 启动流程。
3. 完成 SceneModel 和后端独立代码复审，修复重要问题并运行对应回归测试。
4. 按协议、数据库、认证、各 CRUD、存储、交付配置分组保存小步提交；检查提交只包含项目文件，不包含 .local/.env。
5. 推送功能分支并核实真实 CI 结果。不得把配置文件存在称为 CI 已通过。
6. 全部验收完成之后再讨论下一阶段；当前不实现 Phase 2/3。

## 额度恢复后的检查

- 自动审批恢复，提升权限后完整 pytest 实际运行：**267 passed, 3 skipped, 2 warnings**，退出 0（18.88 秒）。旧的 48 个临时目录 setup errors 已解除。
- 3 个 skip 仅为 Windows 符号链接权限，仍需要 Linux CI；保留两条上游 Starlette/AnyIO 弃用警告。
- 独立 `.local/verify-venv` 从 requirements.lock 安装，再执行 `pip install --no-deps -e .`；`pip check` 无依赖冲突，API 和 scene_schema 导入及 OpenAPI 生成通过。
- 非 editable wheel 构建成功，并检查归档确实包含 smart_home/main.py 和 scene_schema/scene.py；不将此证据等同 Docker 构建。
- 独立复审发现两个 P2：NUL 文本/JSON 写入 PostgreSQL 会返回 500；极端有限坐标在归一化后边坍缩会导致除零。其他租户隔离、认证、迁移、协议与范围未发现阻塞项。
- 两项修复先增加回归测试，确认 **20 项失败**，再修改输入边界与几何校验；修复后 113 项相关测试通过；68 项几何/导出/OpenAPI 检查通过。独立复审确认两项 P2 均已解决，无新增阻塞项。

### 最终本地验证（复审修复后）

| 检查 | 实际结果 |
| --- | --- |
| 完整 pytest / 真实 PostgreSQL | **287 passed, 3 skipped, 2 warnings**，26.23 秒，退出 0 |
| Ruff check / format --check | 通过，67 个 Python 文件格式正确 |
| Scene Schema / OpenAPI --check | 干净安装的 verify-venv 中两者退出 0，生成产物一致 |
| git diff --check | 通过（仅 Windows LF/CRLF 提示） |
| 独立最终复审 | 两项 P2 已解决，无新增可操作问题 |
| Docker / Linux CI | 本机无 Docker，尚未执行；3 项符号链接测试仍待 Linux |

协议检查首次在旧开发虚拟环境中直接执行时因未安装 scene_schema 返回 ModuleNotFoundError；随后在已完成项目安装的干净 verify-venv 中执行成功。没有修改导出检查或依赖测试的 PYTHONPATH 隐藏安装错误。

本地代码与测试已就绪，但在 Docker/Linux CI 实际通过前不声明 Phase 1 全部验收完成。尚未实现 Phase 2/3。
