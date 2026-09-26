# Unity SceneModel 最小客户端（Phase 3-1）

这是离线只读场景查看器源工程，使用原有 SceneModel 1.0.0 JSON；不是新的协议，也尚未通过 Unity Editor 或 iPad 实机验收。

## 启动
1. Unity Hub 安装 Unity 6000.3.0f1（6.3 LTS 基线），打开本目录。生产使用前选择已验证的当前 LTS 补丁。
2. 等待 Package Manager 安装 manifest 中固定版本依赖。
3. 菜单 `SceneConsumer → Create Demo Scene`，保存生成场景，再按 Play。
4. 鼠标拖动旋转、滚轮缩放；触摸拖动/双指缩放为待实机验证的输入入口。
5. 重载示例与重置相机按钮可重新载入 StreamingAssets 文件。

房间显示轮廓，墙显示实体方块，家具显示代理方块。门窗及其他未显示字段保留在原始 JSON，当前不切割洞口。没有可视化编辑、网络认证或后台入口接通。

## 坐标与协议
源坐标为毫米、RH_Z_UP：Unity 位置 `(x, z + floor.elevation_mm, y) / 1000`，尺寸 `(width, height, depth) / 1000`。家具位置按底面中心转换为立方体中心。源 +90° 对应 Unity right 转向 forward，使用映射后的基向量生成四元数。

`SceneDocument` 保留完整 JObject，Export 不从展示对象重建数据。客户端只做版本/单位/有限数等预检查，完整协议校验仍由现有 Pydantic SceneModel 负责。

两室一厅样例由 `tools/export_unity_sample.py` 经过权威 SceneModel 生成。家具 product_id 是明确标记的离线 UUID，不能直接保存到真实商户；本阶段不调用任何商品或场景 API。

## 检查
从仓库根目录执行：
```
python tools/export_unity_sample.py --check
dotnet run --project apps/unity-client/Tests/ConsumerTests.csproj -- apps/unity-client/Assets/StreamingAssets/two-bedroom.json
```
这执行真实 C# 核心测试，但没有编译或执行 Unity 引擎组件。Unity Editor 中打开 Test Runner → EditMode 执行 SceneConsumer.Tests；也可使用 Editor 的 `-batchmode -runTests -testPlatform EditMode -projectPath <本目录> -testResults <XML路径>`。

## iPad
工程面向后续 iOS 构建。需要 Unity iOS Build Support、macOS/Xcode、签名和设备部署，再验证渲染、触摸、性能与生命周期。当前 Windows 电脑没有 Unity Editor、许可或 Xcode；尚未生成 iPad 安装包。不能据核心测试通过宣布 iPad 可运行。

详见 [验证记录](../../docs/phase-3-1-verification.md)。
