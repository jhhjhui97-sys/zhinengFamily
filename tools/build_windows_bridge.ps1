param([Parameter(Mandatory=$true)][string]$NewtonsoftDll)
$ErrorActionPreference='Stop'
$taskRepo=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRepo
$taskOutput=Join-Path $taskRepo '.local/windows-bridge'
New-Item -ItemType Directory -Force $taskOutput | Out-Null
Copy-Item -LiteralPath $NewtonsoftDll -Destination "$taskOutput/Newtonsoft.Json.dll" -Force
$taskCompiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $taskCompiler /nologo /target:library /r:System.Numerics.dll "/r:$taskOutput/Newtonsoft.Json.dll" "/out:$taskOutput/SceneConsumer.Core.dll" apps\unity-client\Assets\SceneConsumer\Core\*.cs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& $taskCompiler /nologo /target:library /define:SQLITE_WINDOWS "/r:$taskOutput/SceneConsumer.Core.dll" "/r:$taskOutput/Newtonsoft.Json.dll" "/out:$taskOutput/LocalScenes.dll" apps\unity-client\Assets\LocalScenes\*.cs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& $taskCompiler /nologo /target:exe /r:System.Numerics.dll "/r:$taskOutput/SceneConsumer.Core.dll" "/r:$taskOutput/LocalScenes.dll" "/r:$taskOutput/Newtonsoft.Json.dll" "/out:$taskOutput/LocalBridge.exe" apps\windows-local\bridge\Program.cs
exit $LASTEXITCODE
