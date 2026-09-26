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
待推送后核实最新 SHA 对应的 Scene consumer core 和 Backend Actions；此处不预填成功。CI 核心检查不执行 Unity Editor。

## 独立源码审查

Critical 0、Important 1、Minor 1；均已修复并复审。补齐 InputLegacy 模块；使用明确保留的 Resources 自定义 Shader，避免仅 Shader.Find 导致构建剥离。复审未发现剩余 Important。此结论属于源码审查，不能替代 Unity 引擎执行。

完整本地后端回归：328 passed、3 skipped、2 warnings（Windows 文件存储用例跳过；Linux CI 单独核实）。Ruff check/format 通过，权威样例漂移、SceneModel 和 OpenAPI 契约检查通过。最初旧账号 smart_home 已不存在，改用新建专用 Phase3 测试数据库后运行成功；未更改开发/真实验收数据库。后端业务与 migration 没有改动。
