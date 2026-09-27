# Phase 3-2B verification — local scene workspace
Base 0585c5e5942a1b183ff4b28842685cd0a1b58110. Branch codex/phase-3-local-scene-ui. User delegates technical decisions; offline standalone iPad is the target.
## Implemented source
SQLite persistent identity (adopts a single existing workspace; refuses ambiguity), paged scene library at 20. LocalSceneSession keeps draft/base on invalid input, conflict and failed transactions. Explicit discard gate for switching, reload, sample and restore. Readonly historical inspection never changes draft; restore appends. Clean duplicate save cannot create another version.
Toolkit Chinese workspace above preview: create/open/sample/save, room-name editing and advanced JSON, current/history JSON and restore, busy state, safe-area layout, minimum 44 reference-unit controls. Pointer admission gate prevents gestures begun on UI from turning into camera motion. Complete SceneModel and deliberate offline sample catalog remain unchanged.
Engine adapter source and two binding tests are present. The adapter has NOT been compiled or executed in Unity here. Do not infer mobile keyboard, actual Chinese glyph coverage, UI rendering, IL2CPP or native iOS SQLite linking from console tests.
## Actual local evidence
304 core checks passed: 7 SQLite + 7 workspace + 11 session + 5 gesture boundary + 256 authority/schema + 11 store + 7 review regression. Real native Windows SQLite, independent transactions/races retained. RED observed before identity, session and gesture implementations; URN room editing regression observed RED then GREEN. Initial session test compile error (missing LINQ using) corrected before behavioral RED.
Prior consumer regression, full backend/Ruff/contracts and unchanged frontend verification are pending this final pass; counts will be recorded only after actual output.
## Toolchain/device limitations
No Unity Editor/license, macOS/Xcode or connected iPad. Editor tests NOT RUN; no installable iPad binary. iOS __Internal binding needs libsqlite3.tbd linked in UnityFramework. OS Chinese font availability and mobile keyboard/touch/safe area must be checked on target. Drafts are held in memory until explicit save; forced process termination can lose unsaved work, but saved revisions remain durable. Files backup/share UI is deferred.
No backend business source, migration, Admin Web source, or JWT behavior changes. No local business CRUD/AI/CAD/VR/quotes.
## CI
Previous local-core code dea5bd6 and its closing docs 0585c5e are dependency evidence only, not proof for this new branch. New exact code SHA and Actions links are pending publication; draft PR will record actual results after verification.
## Decisions
- Continue inline with one final independent reviewer; user delegated technical choices, so no document approval menu.
- Reuse the completed managed worktree and preserve old branches; cost is switching for earlier feedback.
- Supply Toolkit adapter source while Engine/iPad gate is unrun; cost is potential platform adjustments before device delivery. No stubs or simulated engine tests count as proof.
