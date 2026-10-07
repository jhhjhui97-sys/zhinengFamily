# Windows 空间操作与装修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** 完成三向移动和面吸附、可靠模型导入及墙地面装修选择。
**Architecture:** 独立纯几何/模型加载/装修数据模块，现有浏览器UI集成；SceneModel与SQLite快照保持权威。
**Tech Stack:** Node、Three0.180、C#/.NET Framework、SQLite、Edge。
**Spec:** docs/superpowers/specs/2026-10-06-space-models-finishes-design.md

## Global Constraints
- 内部尺寸mm，XY楼层平面/Z向上；吸附阈值50 mm。
- 模型30 MiB，所有解码和素材本机；不上传用户原模型。
- 已保存版本不可变；替换家具模型必须显式操作并保存新版本。
- 装修元数据version1；自定义类别与层次可扩展；厚度为工艺记录。

## Review Focus
- 贴墙边界点、旋转物体、叠放接触与实体穿透。
- 选GLB后点普通新建，及已摆尺寸盒升级模型。
- 空scene/坏accessor/安全data URI/压缩解码失败。
- 共享墙两面装修、凹房间、无显式墙的DXF轮廓。
- 快速切换房间、异步模型/材质、保存恢复和资源释放。

### Task 1: 三向几何与吸附
Files: public/scene-tools.mjs, furniture-gestures.mjs, corresponding tests; parent renderer heightPoint/previewPose, app/index inputs.
Interfaces: editFurniture(scene,id,{x,y,z?,rotation}); snapFurniturePose(scene,id,pose,{thresholdMm:50})->{pose,snapped,contact}; renderer.heightPoint(clientX,clientY,floorElevationMm,anchorPosition)->z.
- [x] 失败测试：保持z、高度拖动、贴墙、平行面、顶底叠放、穿透/房高。
- [x] 实现实际OBB+Z检查和吸附；集成XYZ输入、Shift高度、Alt自由。
- [x] 纯逻辑与真实浏览器通过后提交模块。

### Task 2: 模型可靠导入和实例升级
Files: glb.mjs, public/model-loader.mjs, products.mjs, renderer.mjs, server.mjs, new furniture-assets.mjs; GLB/model/UI tests.
Interfaces: createFurnitureLoader(renderer)->{loadAsync,dispose}; replaceFurnitureAsset(scene,id,product)->SceneModel clone.
- [x] 回归失败：普通新建选GLB不能忽略、旧尺寸实例可升级且旧版本不变、空模型拒绝。
- [x] 精准GLB检查、本地压缩decoder、wasm MIME/CSP；整合原子新建与显式升级。
- [x] 实际电视与匿名多mesh/屏幕fixture验证上传和渲染；检查decoder许可及完整打包后提交。

### Task 3: 装修数据、纹理与编辑
Files: new public/finish-catalog.mjs, finish-tools.mjs, finish-editor.mjs, finish-materials.mjs; app/renderer/index/style integration; finish tests.
Interfaces: finishOptions(surface), normalizeFinish(input,surface), setSurfaceFinish(scene,target,input), clearSurfaceFinish(scene,target), finishForSurface, roomWalls, wallFinishSides; finishTextureData->RGBA/repeat dimensions.
- [x] 失败测试：目录/自定义、多房间/共享墙两面、纹理规格铺法、工艺层和历史不改源。
- [x] 实现数据模块、独立编辑器和材质创建；DXF缺墙边界也可墙面预览。
- [x] 保存恢复/重启及实际材质差异通过后提交。

### Task 4: 打包与审查交付
- [x] 各模块审查，语法/格式、存储与新增Windows真实客户端场景验收。
- [x] 更新说明并创建可审查PR #15。
- [x] 完整Windows回归全绿、视觉证据审查并交付新版便携包，记录最终提交对应结果。

## 当前验证记录
- Windows Actions run 37464647492：便携包构建、离线核心回归、语法/格式检查通过；真实Edge与SQLite合计177项，176通过。
- 三个新增场景均通过：带屏幕贴图的多网格电视与离线Draco、三向摆放/吸附/叠放、墙地面装修/历史版本/重启恢复。
- 旧GLB文案断言已改为验证上传HTTP 422及服务端具体文案，保留文件和商品不被破坏的断言。重启辅助函数先等待操作及请求结束、卸载旧页，再切换服务端口；保留全部错误检查。
- 本地Basis原始解码器对ETC1S与UASTC样本的CPU回退解码通过；压缩GPU格式的实际显示仍需对应显卡验证。
- 最终代码提交 `bc6b746c6d22ca57ee6dfb4eebe57eb979a84b6f` 的 Windows Actions [37600600446](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/37600600446) 全绿：177通过、0失败/取消/跳过；Scene consumer core和Phase 1 backend亦通过。
- 下载后的正式候选包179个清单文件全部SHA256匹配；截图确认真实模型贴图与墙地面装修显示，线性过滤及mipmap消除明显斜视锯齿。交付ZIP SHA256：`38074df36635511edcf48239140f88f494a15ef4692182c5560c0cf89d8836c2`。
