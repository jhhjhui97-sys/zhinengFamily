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
## Final local verification and independent review
Actual final core: 311 checks (7 SQLite, 7 workspace, 14 session, 5 gesture boundaries, 4 confirmation boundaries, 256 authoritative validation/schema, 11 store, 7 earlier review regressions). Existing consumer: 19 coordinate + 9 JSON checks passed. Save/restore races remain genuine independent native connections.
Full PostgreSQL pytest: 331 passed, 3 Windows symlink skips, 2 existing deprecation warnings. Initial run had 217 passed and 114 database setup errors because the temporary server was no longer available. Re-start investigation found PowerShell Start-Process -Wait waits for the descendant server and omitted original startup port. Resolved using WaitForExit on pg_ctl only and explicit port55437/loopback; full final run passed (.local/ui-final-pytest-final.log). Alembic upgrade head passed on the disposable test DB. No business DB changed.
Ruff check/format passed (79 files); Scene/OpenAPI contracts and both offline/sample generators passed. Admin Web tree remains exactly 83cb3bc76b1374e70b50ab49bacbdb59bac4e9da; fresh lint/typecheck/build passed. Initial browser run failed because default Chromium was absent; using supported PLAYWRIGHT_CHANNEL=msedge yielded all 81 passed with mock FastAPI. No frontend mock result is claimed as iPad acceptance.
One independent read-only review: Critical0, Important2, Minor1. Confirmation interactivity/target instability fixed using a tested command gate and immutable document/base/revision intent; core regressions observed RED then GREEN. Adapter test-source gap fixed with seven real Editor tests for attached panel, modal/cancel/target/busy, focus/input, viewport and durable save when preview fails. These seven Editor tests remain NOT RUN; fixes in Toolkit wiring remain unverified until real Editor execution.
Deferred Minor: exactly20 history rows can enable an unnecessary empty next page.
## Rulings and remaining gates
- User delegated technical design/execution; no document approval menu. Cost: presentation choices may need adjustment.
- Reuse clean managed checkout; earlier branches retained. Cost: switch branches for older PR feedback.
- Core evidence does not establish Engine/IL2CPP/iPad behavior. Cost: adapter/font/keyboard/layout/linker changes before packaging.
- Temporary GameObject disable/re-enable is outside current navigation (workspace never deactivated). Cost: future navigation must reinitialize interrupted busy state.
- Unsaved drafts are memory-only. Cost: forced termination can lose unsaved edits, while committed revisions remain durable.
- Files sharing and local business CRUD stay deferred. Cost: later stages are required for the full sales app.
- Exact-head CI is an independent gate; neither review nor dependency green substitutes. Cost: synchronization and acceptance delayed if CI fails.
Git transport repeatedly failed Empty reply/connection timeout; GitHub connector publication may be used with every tree SHA checked against the exact local committed tree. If commit SHAs differ because GitHub records its author/time, preserve original local commits on a source branch; never force-overwrite an existing remote.
Final publication SHA, Actions and draft PR are pending verification here and will be recorded in the PR only after actual completion. Local Docker remains unavailable; CI is the actual build evidence. Editor/iPad package remains a blocker for device usability.

