# Phase 1 执行记录

计划：`docs/superpowers/plans/2026-09-17-phase-1-foundation.md`。

## 恢复点

- 用户已授权从暂停位置继续，设计评审门槛解除；无需重写设计。
- 原提交 `8b8c239` 只有两份文档，无代码、测试或历史测试结果。
- 恢复时 Git status 的两个文档修改标记无对应内容差异；保留原文件。
- 在当前目录开发，使用 `codex/phase-1-foundation` 分支；按用户继续当前仓库的意图，不另建工作树。
- origin 已指向已有 `jhhjhui97-sys/zhinengFamily`，没有创建 GitHub 仓库。
- 恢复时 Git 的 HTTPS helper 实际存在于 bundled Git 的 mingw64/bin；设置进程 GIT_EXEC_PATH 后 ls-remote 成功，当时远端为空。
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
| 8 本地存储 | Linux CI 验证通过 | 实际磁盘往返、越界拒绝与符号链接用例全部通过 |
| 9 Docker/CI/验收 | 已通过 | Linux 全量测试、Ruff、迁移、契约和 Docker build 全部通过 |

Phase 1 已通过复审；最新全量验收以本文 Linux CI 结果为准。下方任务级红绿灯计数属于开发过程证据。

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

## 最新 Linux CI 验收

2026-09-19 核实 [GitHub Actions run 35332531674](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35332531674) 已完成且结论为 success，对应提交 `be0c552b09ff090ed63ebf69da4425e1cc4cf3ed`。

| 检查 | 实际结果 |
| --- | --- |
| 完整 pytest / 真实 PostgreSQL | **290 passed, 2 warnings**；无跳过用例 |
| Ruff lint / format | 通过 |
| Alembic migration | 通过 |
| SceneModel / OpenAPI contract checks | 通过 |
| Docker build | 通过 |
| 独立复审 | 通过，两项 P2 已修复并添加回归测试 |

保留的两条警告来自上游 Starlette/AnyIO 弃用提示，未过滤。此前 Windows 因权限跳过的符号链接用例已在 Linux CI 实际通过。

## 已解决的历史问题

- 早期全量运行因 pytest 临时目录权限发生 setup errors；额度与执行权限恢复后重跑成功。没有删除用例或降低测试要求，旧全量计数已由上方 Linux CI 结果取代。
- 独立干净虚拟环境按 requirements.lock 安装并完成 editable 安装，pip check 无冲突；非 editable wheel 构建与内容检查通过。
- 旧开发虚拟环境未安装 scene_schema 时曾出现 ModuleNotFoundError；在完成项目安装的干净环境执行导出检查成功，未改写检查以掩盖安装问题。
- 独立复审发现 NUL 文本/JSON 写入 PostgreSQL 可能返回 500，以及极端有限坐标归一化后边坍缩可能导致除零。增加 20 项回归先确认失败，再修复；相关测试与独立复审均通过。
- 分组提交曾受额度审批和暂存换行问题影响；均已解决，所有 Phase 1 代码已提交并推送。

本轮仅更新验收文档；未开始 Phase 2。

## 已保存的模块提交

| 提交 | 内容 |
| --- | --- |
| `8b8c239` | 设计与 Phase 1 计划（原始基线，master） |
| `1e0afa1` | FastAPI 工具链与 health |
| `bfe7f90` | SceneModel、JSON Schema、示例与协议测试 |
| `623cf9b` | PostgreSQL 五个实体、固定迁移与数据库测试 |
| `651bd6b` | 商家初始化、认证与用户管理 |
| `4664672` | 客户 API 与租户隔离 |
| `7a0147e` | 商品目录 API |
| `aae0671` | 设计项目 API 与隔离回归 |
| `45d88cb` | 本地对象存储 |
| `0704025` | OpenAPI、Docker/CI、README、架构文档与最终回归 |

分组暂存时遇到 Windows 管道 CRLF 和两份文档末尾空行，均由 git diff --cached --check 拦截；修正暂存脚本及空行后提交成功，没有跳过检查，也没有改动已验证业务代码。

功能分支 `codex/phase-1-foundation` 已推送到 GitHub；原始设计提交作为远端 `main` 基线。[PR #1](https://github.com/jhhjhui97-sys/zhinengFamily/pull/1) 目标为 `main`。本次文档收尾继续提交到该功能分支，不执行合并。
