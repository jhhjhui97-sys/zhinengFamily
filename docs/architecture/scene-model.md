# SceneModel 协议说明

定义源：packages/scene-schema/src/scene_schema。生成文件：packages/scene-schema/scene.schema.json。数据库保存接口和 Unity 适配器不在 Phase 1 实现范围。

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

极端坐标即使每个数值有限，若计算范围溢出或归一化导致边坍缩、无法可靠表达几何形状，也会被拒绝为校验错误。

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
