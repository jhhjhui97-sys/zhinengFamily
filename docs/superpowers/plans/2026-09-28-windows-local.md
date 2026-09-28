# Windows Local Client Implementation Plan
> **For agentic workers:** REQUIRED: superpowers:executing-plans; TDD; one final fresh reviewer.
**Goal:** Run a real local furniture design scene on Windows despite the Unity download blocker.
**Architecture:** Loopback-only Node server, local Three.js render surface in Edge, narrow C# subprocess adapter to existing validated SQLite core.
**Tech Stack:** Node24, Three.js0.180.0, .NET Framework4, native SQLite.
**Spec:** docs/superpowers/specs/2026-09-28-windows-local-design.md
## Global Constraints
- No external runtime API, paid assets, license bypass, previous PR changes or merges.
- Preserve existing SceneModel format, SQLite validation, conflicts and immutable history.
- Actual runtime screenshots; generated concept renders never count.
- No credentials or generated databases/binaries in Git.
## Review Focus
- Cross-origin/DNS rebinding writes blocked by origin, host, same-site session cookie.
- NaN/invalid SceneModel rejected by original validator; failure leaves saved data intact.
- Conflict preserves browser draft and all history.
- Asset failure shows a clear error, never silently labels cubes as realistic models.
- Closing/reopening preserves identity and database; no automatic deletion/reset.
### Task 1: SQLite bridge
**Files:** apps/windows-local/bridge/Program.cs, tools/build_windows_bridge.ps1, apps/windows-local/tests/bridge.test.mjs.
**Interfaces:** stdin {action,id,base_revision,scene,revision,name}; output {status,data,error}. Database/schema/sample paths fixed CLI arguments. list/create/sample/current/save/versions/restore only.
- [ ] Tests first: real create/sample/v1/v2/restorev3/reopen, invalid scene, stalebase409, wrongid404, unknownaction422.
- [ ] Compile/run RED then minimal bridge; GREEN with actual SQLite. Run existing offline suite.
- [ ] Commit bridge and tests.
### Task 2: local service and render transformations
**Files:** apps/windows-local/server.mjs, public/scene-tools.mjs, tests/server.test.mjs, tests/scene-tools.test.mjs.
**Interfaces:** createLocalServer({bridgePath,dataDirectory,assetRoot}); /api/local POST dispatches allowed actions; source RH_Z_UP mm maps to render (x,z,-y)/1000; local model dimensions normalized to requested width/depth/height.
- [ ] RED tests for host/origin/cookie, body bounds, safe subprocess failure, JSON static MIME; coordinate/rotation mapping, bounded furniture edit and no original mutation.
- [ ] Implement minimal server/transforms; GREEN.
- [ ] Commit.
### Task 3: actual render and local workspace
**Files:** public/index.html, style.css, app.mjs, renderer.mjs, assets/sofa.glb, ASSET-LICENSES.md, tests/browser.spec.mjs.
**Interfaces:** consumes Task2 API/transforms; controls library, sample, save, versions/restore, furniture numeric position/rotation, camera, actual model loader.
- [ ] Browser tests first: local create/sample, real canvas/model loaded, change/savev2, restorev1->v3, reload persists, invalid JSON, conflict retains draft; block all non-loopback network to prove offline rendering.
- [ ] Implement focused UI/render modules; run actual Edge tests and inspect real screenshot.
- [ ] Commit verified feature.
### Task 4: launcher and delivery
**Files:** tools/package_windows_local.ps1, apps/windows-local/Start.cmd, docs/windows-local-verification.md.
**Interfaces:** copy bundled Node/bridge/libs/source/assets/licenses into ignored portable output; user data under LocalAppData/ZhinengFamily.
- [ ] Tests for bundle completeness and no source credentials/user database; package and launch from path with spaces.
- [ ] Run all new/existing core regressions, syntax checks and actual browser flow. Record exact screenshot, evidence and remaining scope.
- [ ] Final reviewer, fix Important issues with regression first, commit/push feature branch. No merge.
