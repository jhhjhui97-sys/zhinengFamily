param([Parameter(Mandatory=$true)][string]$NodeExe,[Parameter(Mandatory=$true)][string]$NewtonsoftDll,[Parameter(Mandatory=$true)][string]$NodeLicense,[Parameter(Mandatory=$true)][string]$NewtonsoftLicense,[string]$OutputDirectory)
$ErrorActionPreference='Stop'
$taskRepo=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRepo
if(!$OutputDirectory){$OutputDirectory=Join-Path $taskRepo '.local/windows-portable/智能家居本地版'}
$taskOutput=[IO.Path]::GetFullPath($OutputDirectory)
if(Test-Path -LiteralPath $taskOutput){throw '输出目录已存在。请使用新的空目录，避免覆盖旧版本或用户资料。'}
foreach($file in @($NodeExe,$NewtonsoftDll,$NodeLicense,$NewtonsoftLicense)){if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw '缺少运行时或许可证，请检查构建参数。'}}
$taskSignature=Get-AuthenticodeSignature -LiteralPath $NodeExe
if($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'OpenJS Foundation'){throw 'Node 官方签名校验失败。'}
& "$PSScriptRoot/build_windows_bridge.ps1" -NewtonsoftDll $NewtonsoftDll
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$taskApp=Join-Path $taskRepo 'apps/windows-local'
$taskClient=Join-Path $taskOutput 'runtime/client'
New-Item -ItemType Directory -Force $taskClient,"$taskOutput/runtime/bridge","$taskOutput/licenses","$taskClient/protocol","$taskClient/node_modules/three" | Out-Null
Copy-Item -LiteralPath $NodeExe -Destination "$taskOutput/runtime/node.exe"
Copy-Item -LiteralPath "$taskApp/server.mjs" -Destination "$taskClient/server.mjs"
Copy-Item -LiteralPath "$taskApp/glb.mjs" -Destination "$taskClient/glb.mjs"
Copy-Item -LiteralPath "$taskApp/dxf-analyze.mjs" -Destination "$taskClient/dxf-analyze.mjs"
Copy-Item -LiteralPath "$taskApp/dxf-worker.mjs" -Destination "$taskClient/dxf-worker.mjs"
Copy-Item -LiteralPath "$taskApp/package.json" -Destination "$taskClient/package.json"
Copy-Item -LiteralPath "$taskApp/public" -Destination "$taskClient/public" -Recurse
foreach($file in @('LocalBridge.exe','LocalScenes.dll','SceneConsumer.Core.dll','Newtonsoft.Json.dll')){Copy-Item -LiteralPath "$taskRepo/.local/windows-bridge/$file" -Destination "$taskOutput/runtime/bridge/$file"}
foreach($file in @('scene.schema.json','two-bedroom.json')){Copy-Item -LiteralPath "$taskRepo/apps/unity-client/Assets/StreamingAssets/$file" -Destination "$taskClient/protocol/$file"}
foreach($dir in @('build','examples')){Copy-Item -LiteralPath "$taskApp/node_modules/three/$dir" -Destination "$taskClient/node_modules/three/$dir" -Recurse}
Copy-Item -LiteralPath "$taskApp/node_modules/three/package.json" -Destination "$taskClient/node_modules/three/package.json"
Copy-Item -LiteralPath "$taskApp/node_modules/three/LICENSE" -Destination "$taskOutput/licenses/Three-LICENSE.txt"
foreach($module in @('dxf-parser','loglevel')){Copy-Item -LiteralPath "$taskApp/node_modules/$module" -Destination "$taskClient/node_modules/$module" -Recurse}
Copy-Item -LiteralPath "$taskApp/node_modules/dxf-parser/LICENSE" -Destination "$taskOutput/licenses/DxfParser-LICENSE.txt"
Copy-Item -LiteralPath "$taskApp/node_modules/loglevel/LICENSE-MIT" -Destination "$taskOutput/licenses/Loglevel-LICENSE.txt"
Copy-Item -LiteralPath $NodeLicense -Destination "$taskOutput/licenses/Node-LICENSE.txt"
Copy-Item -LiteralPath $NewtonsoftLicense -Destination "$taskOutput/licenses/Newtonsoft-LICENSE.txt"
Copy-Item -LiteralPath "$taskApp/ASSET-LICENSES.md" -Destination "$taskOutput/licenses/ASSET-LICENSES.md"
$taskCompiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $taskCompiler /nologo /target:winexe /r:System.Windows.Forms.dll "/out:$taskOutput/智能家居.exe" ([IO.Path]::GetFullPath("$taskApp/launcher/Program.cs"))
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$taskInstructions=@('智能家居 Windows 本地体验版','双击「智能家居.exe」启动，无需联网或后台服务器。','运行条件：Windows10/11、Microsoft Edge、.NET Framework4.8。','新建客户 → 新建设计项目 → 新建方案 → 载入示例或导入 DXF → 放入家具 → 保存和恢复版本。','DXF 首版支持二维直线和闭合房间轮廓；需要核对单位，单位不明时用已知线段校准。墙厚 200 mm 和层高 2800 mm 为估算值。','点顶部「商品管理」可新建、搜索、筛选和编辑本机在售商品；为已保存商品选择本机 GLB 文件并点击「导入当前商品 3D 模型」，单个文件最大 30 MiB。','导入后可在设计工作台摆放该 SKU；每次场景保存会固定当时模型版本，后来替换商品模型不会更改旧方案。','在项目方案中先保存含在售商品的场景版本，再点「生成报价」；报价保留当时商品名称、SKU、单价和数量，可打印或另存 PDF。演示家具不计价。','旧版未关联项目的场景可从「旧方案入口」打开；升级时数据库会先自动生成不覆盖的迁移备份。','用户资料、导入模型及 DXF 原图保存在 %LOCALAPPDATA%\ZhinengFamily；升级前建议自行备份整个目录，切勿删除原资料。','本机资料与在线后台不会自动同步；四款已授权演示 3D 模型不代表门店在售商品。要展示某件在售商品的真实外观，须导入该商品获授权的 GLB 模型。','打开已保存报价可创建、确认、取消并打印本机订单；订单保留商品价格快照，但不代表付款或锁定库存。','目前不包含支付、库存管理、DWG/PDF、自动门窗水电识别、AI 自动布局或 VR。','可执行文件未购买商业代码签名，企业安全软件可能要求确认来源。')
$taskInstructions | Set-Content -Encoding UTF8 "$taskOutput/使用说明.txt"
$taskFiles=Get-ChildItem -LiteralPath $taskOutput -Recurse -File | ForEach-Object { @{path=$_.FullName.Substring($taskOutput.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} }
$taskRevision=git rev-parse HEAD
$taskDirty=!!(git status --porcelain)
@{sourceRevision=$taskRevision;sourceDirty=$taskDirty;createdAt=[DateTime]::UtcNow.ToString('o');files=@($taskFiles)} | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 "$taskOutput/manifest.json"
Write-Output "Windows local bundle: $taskOutput"
