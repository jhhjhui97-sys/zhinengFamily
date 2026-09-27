# Phase 3-1 Unity SceneModel 最小消费设计

基线：已验收 Phase2 `77ea33c9ddc1877b7439edbb5308db1d13254fe1`（14b35d2 产品代码 + 最新真实冒烟记录）。PR#2 尚未合并，Phase3 独立分支 `codex/phase-3-scene-consumer`；不得声称基于已合并 main。

目标：消费权威两室一厅 JSON，显示房间轮廓、墙体和示例家具，基本相机查看。用户已明确授权 Phase3-1；本次 inline 执行，设计/计划/测试和证据随代码保存。不是可编辑或联网 Unity 商业客户端。

选择：动态 JSON 文档保留所有字段，纯 C# 坐标适配器 + Unity 显示组件。相比手写 C# SceneModel DTO，此方案避免第二套协议和序列化丢字段；相比引入完整代码生成/场景编辑器，范围更小。协议定义源仍是 scene_schema Pydantic，生成示例经过真实 SceneModel 校验；客户端前置检查不替代完整后端校验。

坐标：source (x,y,z) mm → Unity (x,z+floor_elevation,y)/1000 m。家具 position 是底面中心，显示方块中心再加 height/2。尺寸 (width,depth,height) → (width,height,depth)/1000。RH_Z_UP 正旋转由基向量变换后确定 Unity 朝向；+90° 时本地 +X 应朝 Unity +Z，不能复制成 Unity +90° yaw。恢复坐标减掉楼层标高，再恢复 mm。多楼层不重复叠加 elevation。

模块：纯数学 PresentationVector/SceneCoordinates；SceneDocument 保留 JObject，检查支持版本/单位/坐标、有限数；SceneRenderer 按 floor_id 显示轮廓、实心墙、家具包围方块；DemoBootstrap 加载 StreamingAssets；OrbitCamera 支持鼠标及触摸查看。房间暂为轮廓线，门窗不切墙，不展示 GLB，不进行编辑/保存/认证/API 请求。

Unity 基线 6000.3.0f1（Unity 6.3 LTS 系列），导入时可选择同系列最新补丁，但升级须单独验证。包 com.unity.nuget.newtonsoft-json 3.2.2（Unity 官方包，对应 Newtonsoft.Json13.0.2）；Unity Test Framework 1.4.6。Editor 菜单生成演示场景，不手写场景 YAML。iOS 最终构建需要 Unity iOS 模块、macOS/Xcode/签名和真实 iPad。

环境调查（2026-09-26）：Windows；常规安装目录、PATH、用户 Unity 目录未发现 Hub/Editor，未发现许可证文件和 dotnet SDK；系统 .NET Framework csc 可用。纯 C# 实际编译执行测试可进行；Unity Editor/EditMode/Player/iPad 一律未执行。不得将 C# 测试或 Python 协议校验称为 Unity/iPad 完成。

样例：从 apps/admin-web/lib/two-bedroom.json 生成 canonical SceneModel，加入一件明确离线示例家具。product_id 是离线示例引用，不是任何商户业务商品，本阶段没有任何保存 API，禁止拿此示例直接保存到真实商户。完整序列化必须保留 doors/windows/metadata 等尚未显示字段。

验证：纯 C# 实例输入测试转换、反转换、尺寸、90/270° 基向量、楼层隔离、非有限值/非法尺寸；Python 校验样例与生成漂移；Unity EditMode 文档往返及真实 GameObject 位置/尺寸/旋转测试准备。CI 只验证可执行的纯 C# 和 Python 契约，Unity CI 必须等待许可证和 Editor，不能虚构成功。

参考：[Unity6.3 LTS](https://unity.com/releases/unity-6/support)、[Newtonsoft 官方包](https://docs.unity3d.com/Packages/com.unity.nuget.newtonsoft-json@3.2/manual/index.html)、[Unity 坐标/旋转](https://docs.unity3d.com/6000.3/Documentation/Manual/QuaternionAndEulerRotationsInUnity.html)、[iOS 构建](https://docs.unity3d.com/6000.3/Documentation/Manual/iphone-BuildProcess.html)。
