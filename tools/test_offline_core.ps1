param([Parameter(Mandatory=$true)][string]$NewtonsoftDll)
$ErrorActionPreference = 'Stop'
$sceneRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $sceneRoot
$sceneCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$sceneOutput = Join-Path $sceneRoot '.local/offline-core'
New-Item -ItemType Directory -Force -Path $sceneOutput | Out-Null
Copy-Item -LiteralPath $NewtonsoftDll -Destination (Join-Path $sceneOutput 'Newtonsoft.Json.dll') -Force
$sceneJson = Join-Path $sceneOutput 'Newtonsoft.Json.dll'
$sceneCore = Join-Path $sceneOutput 'SceneConsumer.Core.dll'
$sceneLocal = Join-Path $sceneOutput 'LocalScenes.dll'
$sceneTests = Join-Path $sceneOutput 'offline-tests.exe'
& $sceneCompiler /nologo /target:library /r:System.Numerics.dll "/r:$sceneJson" "/out:$sceneCore" apps\unity-client\Assets\SceneConsumer\Core\*.cs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $sceneCompiler /nologo /target:library /define:SQLITE_WINDOWS "/r:$sceneCore" "/r:$sceneJson" "/out:$sceneLocal" apps\unity-client\Assets\LocalScenes\*.cs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $sceneCompiler /nologo /main:OfflineTests /r:System.Numerics.dll "/r:$sceneCore" "/r:$sceneLocal" "/r:$sceneJson" "/out:$sceneTests" apps\unity-client\Tests\OfflineTests.cs apps\unity-client\Tests\SqliteTests.cs apps\unity-client\Tests\ValidationTests.cs apps\unity-client\Tests\LocalStoreTests.cs apps\unity-client\Tests\LocalMigrationTests.cs apps\unity-client\Tests\LocalSalesTests.cs apps\unity-client\Tests\LocalProductTests.cs apps\unity-client\Tests\LocalModelAssetTests.cs apps\unity-client\Tests\LocalQuotationTests.cs apps\unity-client\Tests\ReviewRegressionTests.cs apps\unity-client\Tests\LocalWorkspaceTests.cs apps\unity-client\Tests\LocalSessionTests.cs apps\unity-client\Tests\PreviewGestureTests.cs apps\unity-client\Tests\ConfirmationTests.cs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $sceneTests apps/unity-client/Assets/StreamingAssets/scene.schema.json apps/unity-client/Tests/Fixtures/offline-validation.json apps/unity-client/Assets/StreamingAssets/two-bedroom.json
exit $LASTEXITCODE
