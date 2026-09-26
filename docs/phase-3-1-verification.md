# Phase 3-1 验证记录

基线：77ea33c9ddc1877b7439edbb5308db1d13254fe1，来自未合并的 Phase 2 分支。
独立分支：codex/phase-3-scene-consumer。Phase 2 PR #2 未合并；本阶段 PR 以该分支为基底。

## 范围
权威 JSON 消费、坐标与尺寸/旋转转换、房间轮廓/墙/家具代理、楼层标高、基础相机。原始 JSON 往返保留未显示字段。不修改后端业务、认证或管理页面；无 CAD/AI/VR/上传/报价。

## 本地证据
2026-09-26：先观察缺少坐标/文档实现的 C# 编译失败，以及缺少生成器/样例的 Python 测试失败，再实现。
实际系统 C# 编译器执行：19 个坐标用例 + 9 个 JSON 用例通过。
实际 Pydantic 样例测试：3 passed，2 个既有警告。完整后端及 CI 结果需以对应提交运行记录为准。

## 尚未执行
Unity Editor 导入、EditMode 几何测试、Play、桌面/iOS 构建、iPad 实机：当前环境没有 Unity Hub/Editor/许可、macOS/Xcode。已提供 3 个 Editor 回归测试，不能把核心 C# 编译当作引擎代码编译或运行验收。
本阶段为离线客户端，不声称完成 FastAPI/浏览器/Unity 实际链路。

## CI
代码 SHA `6d40eb0fa5e3611ce4dd04db40d298554343834d` 已实际核实：
- [Scene consumer core](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36251259913)：success，19 坐标 + 9 JSON 用例；权威样例检查通过。
- [Backend](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36251259935)：success，331 passed、2 warnings；Ruff、Alembic、Scene/OpenAPI 契约、Docker config/build 全部通过。

CI 核心检查不执行 Unity Editor。最终证据文档提交的最新 SHA/Actions 链接会核实并更新在 [草稿 PR #3](https://github.com/jhhjhui97-sys/zhinengFamily/pull/3)；不能用此代码 SHA 替代更新后 SHA 的验证。

## 独立源码审查

Critical 0、Important 1、Minor 1；均已修复并复审。补齐 InputLegacy 模块；使用明确保留的 Resources 自定义 Shader，避免仅 Shader.Find 导致构建剥离。复审未发现剩余 Important。此结论属于源码审查，不能替代 Unity 引擎执行。

完整本地后端回归：328 passed、3 skipped、2 warnings（Windows 文件存储用例跳过；Linux CI 单独核实）。Ruff check/format 通过，权威样例漂移、SceneModel 和 OpenAPI 契约检查通过。最初旧账号 smart_home 已不存在，改用新建专用 Phase3 测试数据库后运行成功；未更改开发/真实验收数据库。后端业务与 migration 没有改动。

Git CLI 的 GitHub 连接连续重置/超时；改用 GitHub 连接器发布六个分步提交，每个 tree SHA 与本地完全一致，再校验并导入远端 Git 提交对象。本地原提交保存在 refs/archive 下；Phase 2 分支未修改。远端与本地 Phase 3 分支已对齐。

最终配置核对补充：新增程序集引用解析预检查，先确认错误 Unity.Newtonsoft.Json 引用导致测试失败，再改为 overrideReferences + Newtonsoft.Json.dll；测试程序集明确引用 TestRunner 与 nunit.framework.dll。依据 [Unity 官方程序集文件格式](https://docs.unity.cn/Manual/AssemblyDefinitionFileFormat.html)。此检查仍不替代 Unity Editor 编译；修复后的 CI 数量以 PR 最新 SHA 为准。

程序集修复后本地全量回归：329 passed、3 skipped、2 warnings；新增样例/配置用例 4 passed，Ruff check/format 通过。Unity 官方注册表 3.2.2 压缩包实际列出 Runtime/Newtonsoft.Json.dll 与 AOT 变体，不包含 Unity.Newtonsoft.Json.asmdef；下载仅保存在忽略的 .local 目录。配置修复已独立复审，无剩余 Important。修复后最终 Actions 尚需核实，最新证据更新到 PR #3。
