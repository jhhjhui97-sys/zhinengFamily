# Windows 本地设计工作室

这是可以在 Windows 10/11 本机运行的**离线客户、项目、商品、3D 场景、报价和订单体验版**。双击便携包中的 `智能家居.exe`，独立 Edge 窗口会自动打开；不需要 Mac、Unity、Node、Python、PostgreSQL 或外部服务器。运行机器需要 Microsoft Edge 与 .NET Framework 4.8。资料在 `%LOCALAPPDATA%\ZhinengFamily\scenes.sqlite`，请定期备份整个目录；升级便携包时保留该目录。便携目录可放在任意本地磁盘，路径中有空格和中文也可启动。

操作：填写并保存客户 → 填写并保存该客户的设计项目 → 新建项目方案 → 载入两室一厅 → 从演示目录选家具及房间放入场景 → 拖动/滚轮查看 → 调整家具 X/Y 坐标及角度 → 保存 v1/v2 → 查看版本 → 恢复旧版生成新版本。客户和项目可重新选择、编辑；同名项目允许分属不同客户。旧版已保存但尚未关联项目的场景保留在“旧方案入口”，不会自动归到某个客户。支持只读历史 JSON、高级场景 JSON 校验和导出真实渲染 PNG。冲突返回中文提示并保留未保存内容。场景使用原有 SceneModel 全量校验和 SQLite 不可变版本，C# 桥接在本机运行。Node 服务只监听 `127.0.0.1` 随软件启动，退出窗口后由启动器关闭。浏览器没有 FastAPI JWT，也不连接远端 API；端口是临时分配的。

真实本机画面：[客户项目中的 3D 场景](../../docs/images/windows-offline-sales-room.png)。左侧的客户和项目表单可折叠；左、中、右栏在桌面宽度下独立滚动，查看项目时场景始终留在视野中。

首次打开旧版 `scenes.sqlite` 时，软件会先用 SQLite 在线备份生成不覆盖的 迁移前备份，再在事务中升级客户、项目、场景、商品、模型和报价表；失败会回滚，原数据仍可恢复。升级前仍建议自行复制整个 `%LOCALAPPDATA%\ZhinengFamily` 目录。离线客户/项目/商品资料与在线后台的账号或 PostgreSQL 数据**不会自动同步**。

内置四款 Khronos glTF 示例模型：复古三人沙发、织物单人椅、丝绒沙发和商用冰箱，含真实纹理与材质；物理光照、阴影与场景中毫米尺寸放缩均使用本地资源。房间木地板也使用离线 PBR 贴图，浅色墙面使用法线和粗糙度贴图；贴图缺失时会明确提示，仅缺失贴图的表面回退到基础材质。模型与材质创作者、许可和文件哈希见 [第三方素材清单](ASSET-LICENSES.md)。这些是演示商品和环境，不代表商家实际库存或指定铺装。[这张图](../../docs/images/windows-offline-room-materials.png)来自实际 Edge 离线客户端，不是 AI 生成的效果概念图。

商品管理：点顶部“商品管理”，录入分类、品牌、名称、SKU、价格、毫米尺寸及可选 JSON 属性。可按名称/SKU/品牌搜索、任意分类筛选并每页查看 20 条；修改过期时提示冲突并保留表单。价格按原始十进制字符串显示，不经浮点重新计算。保存商品后，可选择获授权的 `.glb` 文件（最大 30 MiB），点“导入当前商品 3D 模型”；导入后该 SKU 出现在设计工作台的“在售”目录。新建 SKU 本身**不会自动生成 3D 模型**。场景版本固定导入模型的资产 ID，后来替换商品模型不会改变旧版场景。导入文件和 SQLite 都在 `%LOCALAPPDATA%\ZhinengFamily`，备份时须复制整个目录。

真实本机商品页画面：[1024px 横屏商品管理](../../docs/images/windows-offline-products.png)。图中商品为自动化测试在真实本机 SQLite 创建的示例资料，产品页面、筛选、金额和详情均由实际 Edge 客户端渲染。

导入商品模型后的[实际场景画面](../../docs/images/windows-offline-sku-model.png)由 Edge 在真实本机 SQLite 上生成；前方为关联 SKU 的导入 GLB，后方为内置演示家具。

报价：在项目方案中摆放已导入模型的在售 SKU，保存场景版本后点“生成报价”。报价按本机当前商品单价生成一次性快照，保留当时的名称、SKU、单价、数量和总价；商品后来改价不会改变旧报价。内置演示家具不计价，纯演示场景不能生成报价。报价可以再次打开、打印或存为 PDF；这是商品参考价，不含运费、安装费和税费的最终约定。真实本机画面见[报价截图](../../docs/images/windows-offline-quotation.png)。

订单：打开已保存报价，点“由此报价创建订单”。同一份报价重复点击只会读取同一张订单；草稿可确认或取消，已确认订单仍可取消，状态历史保留。订单商品与金额独立快照，后续商品改价或场景恢复不改变旧单；可打印或存为 PDF。订单**不代表已付款或锁定库存**。真实本机画面见[订单截图](../../docs/images/windows-offline-order.png)。

当前限制：内置目录只有四款演示模型；实际在售商品须由门店提供合法且画质合格的 GLB 文件，软件不能凭 SKU 自动生成逼真的模型。摆放仍是简单位置/角度调整。房间使用固定示例铺装，没有自选材质、丰富灯具或真实商品的房间材料报价；支付、库存管理、自动 AI 布局和原生 CAD/VR 尚未实现。这是可用的本地客户→项目→场景和商品管理体验版，**不是完整门店交付系统**。Unity 6000.3.0f1 工程保留，但本机官方 Editor 下载重定向到返回 404 的节点，因此 Unity Editor/Player 未验收；Windows 版采用不依赖 Unity 许可的本地浏览器渲染。

开发构建：先运行 `npm ci --prefix apps/windows-local`，准备 Node24、Newtonsoft.Json 13.0.2 `net45` DLL 和对应许可证，再运行 `tools/package_windows_local.ps1`。该脚本拒绝覆盖已有输出目录。运行 `npm test --prefix apps/windows-local`、`npm run check --prefix apps/windows-local`、`npm run format:check --prefix apps/windows-local` 验证。证据见 [Windows 验证记录](../../docs/windows-local-verification.md)。
