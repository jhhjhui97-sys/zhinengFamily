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
Copy-Item -LiteralPath "$taskApp/package.json" -Destination "$taskClient/package.json"
Copy-Item -LiteralPath "$taskApp/public" -Destination "$taskClient/public" -Recurse
foreach($file in @('LocalBridge.exe','LocalScenes.dll','SceneConsumer.Core.dll','Newtonsoft.Json.dll')){Copy-Item -LiteralPath "$taskRepo/.local/windows-bridge/$file" -Destination "$taskOutput/runtime/bridge/$file"}
foreach($file in @('scene.schema.json','two-bedroom.json')){Copy-Item -LiteralPath "$taskRepo/apps/unity-client/Assets/StreamingAssets/$file" -Destination "$taskClient/protocol/$file"}
foreach($dir in @('build','examples')){Copy-Item -LiteralPath "$taskApp/node_modules/three/$dir" -Destination "$taskClient/node_modules/three/$dir" -Recurse}
Copy-Item -LiteralPath "$taskApp/node_modules/three/package.json" -Destination "$taskClient/node_modules/three/package.json"
Copy-Item -LiteralPath "$taskApp/node_modules/three/LICENSE" -Destination "$taskOutput/licenses/Three-LICENSE.txt"
Copy-Item -LiteralPath $NodeLicense -Destination "$taskOutput/licenses/Node-LICENSE.txt"
Copy-Item -LiteralPath $NewtonsoftLicense -Destination "$taskOutput/licenses/Newtonsoft-LICENSE.txt"
Copy-Item -LiteralPath "$taskApp/ASSET-LICENSES.md" -Destination "$taskOutput/licenses/ASSET-LICENSES.md"
$taskCompiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $taskCompiler /nologo /target:winexe /r:System.Windows.Forms.dll "/out:$taskOutput/智能家居.exe" ([IO.Path]::GetFullPath("$taskApp/launcher/Program.cs"))
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$taskInstructions=@('智能家居 Windows 本地体验版','双击「智能家居.exe」启动，无需联网或后台服务器。','运行条件：Windows10/11、Microsoft Edge、.NET Framework4.8。','新建方案 → 载入两室一厅 → 调整沙发位置/角度 → 保存新版本。','可查看、恢复历史版本，导出当前真实渲染截图。','用户资料保存在 %LOCALAPPDATA%\ZhinengFamily，升级时不要删除该目录。','当前仅接入一个真实沙发模型；更多商品模型及完整本地业务管理仍在开发中。','可执行文件未购买商业代码签名，企业安全软件可能要求确认来源。')
$taskInstructions | Set-Content -Encoding UTF8 "$taskOutput/使用说明.txt"
$taskFiles=Get-ChildItem -LiteralPath $taskOutput -Recurse -File | ForEach-Object { @{path=$_.FullName.Substring($taskOutput.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} }
$taskRevision=git rev-parse HEAD
$taskDirty=!!(git status --porcelain)
@{sourceRevision=$taskRevision;sourceDirty=$taskDirty;createdAt=[DateTime]::UtcNow.ToString('o');files=@($taskFiles)} | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 "$taskOutput/manifest.json"
Write-Output "Windows local bundle: $taskOutput"

