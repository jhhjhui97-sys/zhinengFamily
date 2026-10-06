# Windows 商品与场景操作修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 完成商品编辑删除、实时目录、家具删除及 GLB 导入新建商品。
**Architecture:** 现有离线 modular monolith；商品 v8 软删除，目录支持尺寸模型；GLB 文件先校验暂存，数据库产品和资产原子创建。
**Tech Stack:** C# SQLite、Node HTTP、Three.js、原生中文 UI。
**Spec:** docs/superpowers/specs/2026-10-06-product-scene-actions-design.md

## Global Constraints
- 内部长度 mm，沿用 workspace 隔离和修订冲突。
- 商品删除不删除旧资产或历史，SKU 保留。
- GLB 最大 30 MiB、同源本机授权，无新增依赖。
- 商品目录与草稿独立，刷新目录不能重写已摆实例。

## Review Focus
- 删除正在最后一页的商品后分页须能回到有效页。
- 无模型的新商品仍能显示和保存。
- 导入失败不产生新商品，选中文件保留供重试。
- 删除在售商品后历史场景和报价仍可读。
- 编辑名称尺寸不能悄悄改变已保存家具实例。

### Task 1: 核心商品生命周期及桥接
Files: LocalProductStore.cs, LocalModelAssetStore.cs, LocalSceneStore.cs, LocalIdentity.cs, bridge/Program.cs, LocalProductTests.cs, LocalModelAssetTests.cs, LocalMigrationTests.cs.
Interfaces: DeleteLocalProduct(id,baseRevision); LocalCatalogProducts(); CreateLocalProductWithModel(商品参数,sha,byteCount); bridge product_delete/product_create_model；catalog 返回 sellable=true 和可用模型信息。
- [x] 写删除/事务创建/v7升级失败测试，观察失败。
- [x] 实现 v8 标记删除、有效过滤、事务创建。
- [x] 真实 SQLite 完整346项检查通过，桥接编译及实际操作通过。

### Task 2: 流式模型暂存端点
Files: server.mjs, tests/model-import.test.mjs.
Interface: POST /api/model-files GLB binary -> {status:200,data:{sha256,byte_count}}，与已有模型上传相同授权、限额、超时和校验。
- [x] 写暂存有效/无效/未授权测试，观察端点未实现时405失败。
- [x] 复用上传流程，实现暂存返回值。
- [x] 本机真实 HTTP 暂存测试2/2通过，服务器及测试语法通过。

### Task 3: 商品及家具操作 UI
Files: public/products.mjs, app.mjs, index.html, scene-tools.mjs, renderer.mjs, tests/browser.spec.mjs, scene-tools.test.mjs.
Interfaces: mountProducts({api,onChanged}); onChanged 调用 loadCatalog；stage then product_create_model；no model sellable product rendered as dimension proxy。
- [x] 写实例删除纯逻辑测试与浏览器完整操作测试。
- [x] 增加编辑/删除入口、目录刷新及尺寸盒、新建模型商品按钮。
- [x] 删除家具校验草稿并提醒保存。
- [ ] 格式/逻辑测试及 Windows 浏览器回归，提交。

### Task 4: 集成与交付
- [ ] 汇总独立文件改动，审查商品生命周期、历史、上传事务边界。
- [ ] 更新 README 操作说明；发布 PR 更新触发完整 Windows CI。
- [ ] 核查全套结果、修复失败、更新可审查 PR 和便携包下载。

Implementation decision: 无 GLB 在售商品也必须按真实单价参与报价，避免尺寸模型可摆放却不计价；保留演示商品不计价规则，并补真实 SQLite 与浏览器回归。
