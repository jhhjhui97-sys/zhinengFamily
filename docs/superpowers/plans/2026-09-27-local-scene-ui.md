# Phase 3-2B local scene UI implementation plan
Goal: operate the persisted offline library and immutable scene history from a Chinese Unity client.
Architecture: LocalSceneStore + LocalIdentity + engine-independent LocalSceneSession; Unity Toolkit view + existing renderer.
Stack: existing C# / Json.NET / native SQLite, Unity 6000.3 UI Toolkit.
Spec: docs/superpowers/specs/2026-09-27-local-scene-ui-design.md
## Global constraints
Offline only; no HTTP/JWT/business CRUD. Preserve SceneModel schema, previous commits and user data. Chinese safe errors; 20-item pages; 44-point controls. No merge. No Engine/iPad acceptance claim from console tests.
User delegates technical decisions and continuous inline execution; written-artifact approval menus are waived by that instruction.
## Review focus
- Restart must reuse the same local workspace and actor, including existing single-workspace data.
- Invalid drafts, conflict and storage failure must retain draft and base revision.
- Switching and restore must require discard confirmation; historical JSON must not become an editable current revision implicitly.
- Gestures originating over UI must not move the camera when dragged into preview.
- Missing fonts, unrenderable valid snapshots, lifecycle closure and engine-only configuration must fail safely and remain documented where tools cannot run them.

### Task 1: persistent identity and library
Files: Assets/LocalScenes/LocalIdentity.cs, LocalSceneStore.cs, LocalScenePage.cs; Tests/LocalWorkspaceTests.cs; OfflineTests runner/project/tool.
Interfaces: LocalIdentity.Open(path) -> WorkspaceId/ActorId. store.Documents(limit=20,offset=0) -> Total/Items(Id,Name,Revision,UpdatedAt).
Steps: write real SQLite restart/adoption/ambiguity/isolation/list pagination/order/invalid argument tests; run missing behavior RED; implement transactionally; run whole offline suite GREEN; commit.
Command: powershell -ExecutionPolicy Bypass -File tools/test_offline_core.ps1 -NewtonsoftDll .local/consumer-tests/Newtonsoft.Json.dll
Expected: new scenarios and all existing suites pass.

### Task 2: tested local session
Files: Assets/LocalScenes/LocalSceneSession.cs; Tests/LocalSessionTests.cs.
Consumes Task1 identity/library and store Put/Restore/Current/Versions. Produces session New/Open/LoadSample/SetDraft/ChangeRoomName/Preview/Save/ViewHistory/Restore plus draft/base/dirty/status. Operations return bool and safe Message; sample catalog registered only on explicit sample use.
Steps: tests first (full v1/v2/v3/reopen; dirty confirmation; readonly historical inspection; invalid/conflict/SQL failure retaining draft; clean save no duplicate; invalid room edits; history page); RED; minimal production; whole suite GREEN; commit.
Command above. Expected: session scenarios use real SQLite, no mock persistence.

### Task 3: Unity UI and input adapter
Files: Assets/SceneConsumer/Runtime/LocalSceneWorkspace.cs, DemoBootstrap.cs, OrbitCamera.cs, runtime asmdef; Packages/manifest.json; Editor scene setup; Editor tests.
Consumes Task2 session; Toolkit only maps controls, no second store/client. Add local DB in Application.persistentDataPath, disable legacy auto bootstrap while workspace active. Chinese library/editor/history, confirm discard, busy state, readonly current/history JSON, safe errors and preview status. Input region gate tested independently; Unity Editor tests exercise real view controls/safe area/input boundaries.
Steps: behavioral camera gate/session binding tests before implementation; console RED/GREEN; add Engine tests first; build UI adapter; run available full suites. Editor tests remain NOT RUN if Editor unavailable; never substitute stubs.
Command: offline tool plus Unity EditMode command documented for toolchain owner.
Expected: console passes; engine execution explicitly recorded pending.

### Task 4: final verification and publication
Update root/client README, docs/phase-3-2b-verification.md with local/CI/device evidence separated.
Run offline and old consumer suites, Python fixture/contracts/Ruff/backend and unchanged frontend appropriate checks. One fresh reviewer of whole branch per executing-plans; fix Important/Critical in one TDD pass. Push, verify exact-SHA Actions, draft dependent PR to local-core branch, attach. Do not merge.
Expected: actual CI success for exact code SHA or explicit blocker; no imagined iPad install.
