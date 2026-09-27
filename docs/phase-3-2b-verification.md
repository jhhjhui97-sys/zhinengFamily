# Phase 3-2B verification — local scene workspace

Base: 0585c5e5942a1b183ff4b28842685cd0a1b58110.
Branch: codex/phase-3-local-scene-ui.
Verified source SHA: 56e296082692beeaaa6f7e59c47f05b8d31305cf.
Target: standalone offline iPad use. Source and core delivery do not establish an installable or device-accepted app.

## Implemented source

SQLite persistent identity adopts a single existing workspace and refuses ambiguous or damaged identity. The scene library uses 20-item pagination. LocalSceneSession keeps draft and base revision on invalid input, conflicts and failed transactions. Switching, reloading, loading a sample and restoring require an explicit discard decision when dirty. Historical inspection is read-only; restoration appends a new version. Saving an unchanged draft does not create a duplicate version.

The Chinese UI Toolkit workspace provides new/open, a genuine two-bedroom sample, save, room-name editing, advanced JSON, current/history JSON and restoration. Busy and confirmation gates prevent unintended commands. A captured document/base/revision fixes the restore target. Safe-area layout and controls of at least 44 reference units are implemented in source. Gestures begun on UI cannot turn into camera motion. The authoritative SceneModel and deliberate offline sample catalog remain compatible.

Seven real Unity Editor tests are present. The adapter and tests have NOT been compiled or executed in Unity here. Do not infer mobile keyboard, Chinese glyph coverage, rendering, IL2CPP or native iOS SQLite linking from console tests.

## Actual local evidence

- 311 offline core checks: 7 SQLite, 7 workspace, 14 session, 5 gesture boundaries, 4 confirmation boundaries, 256 authoritative validation/schema, 11 store and 7 earlier review regressions. Real native Windows SQLite and independent-connection races were used.
- Existing consumer checks: 19 coordinate and 9 JSON passed.
- PostgreSQL pytest: 331 passed, 3 Windows symlink skips, 2 existing deprecation warnings. Ruff check/format passed for 79 files. Alembic upgrade head, Scene/OpenAPI contracts and sample/offline fixture generators passed.
- Unchanged Admin Web tree 83cb3bc76b1374e70b50ab49bacbdb59bac4e9da: fresh lint, typecheck and build passed; 81 browser tests passed using Mock FastAPI and the supported Edge channel. These are not offline iPad or real backend UI acceptance tests.
- Local Docker is unavailable. Docker build evidence comes from actual Linux CI below.

RED was observed before identity, session, gesture, UUID editing, confirmation gate and captured restore intent implementations. Initial session compilation lacked a LINQ import; it was fixed before the behavioral RED run.

The first full backend attempt had 217 passed and 114 setup errors because the temporary PostgreSQL server was unavailable. Startup recovery used WaitForExit on pg_ctl only, an explicit port 55437 and loopback binding; the final full run passed. Only the disposable test database was used. The first browser attempt lacked default Chromium; supported PLAYWRIGHT_CHANNEL=msedge produced the final 81 passed. Failed attempts do not count as acceptance.

## Actual exact-source CI

The following PR runs report head SHA 56e296082692beeaaa6f7e59c47f05b8d31305cf. Job steps and decoded test logs were checked after completion.

- [Scene consumer core](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36329227615): success; 311 offline core checks plus 19 coordinate and 9 JSON checks.
- [Backend](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36329227618): success; 334 passed, 2 warnings; Ruff/format, Alembic, contracts and Docker build passed.
- [Admin Web](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/36329227626): success; 81 passed; lint, typecheck and build passed.

These workflows do not compile Unity Engine code or package iOS. Earlier dependency green is not used as evidence for this source SHA. Final documentation commit evidence is recorded in [draft PR #5](https://github.com/jhhjhui97-sys/zhinengFamily/pull/5) after its own runs finish; the code SHA above remains an explicit source checkpoint.

## Independent review and regressions

One independent read-only review reported Critical 0, Important 2 and Minor 1. The confirmation interactivity/target issue was fixed with a tested command gate and immutable document/base/revision intent; core regressions were observed RED then GREEN. The adapter test-source gap was addressed with seven Editor tests covering field/history binding, modal/cancel/target/busy state, attached panel focus/input, viewport conversion and durable save when preview fails. The final test-source commit distinguishes v1/v2 by room content and expands the editing foldout before checking focus.

All seven Editor tests remain NOT RUN. The Toolkit wiring therefore still needs real Engine verification. Deferred Minor: exactly 20 history rows can enable an unnecessary empty next page; saved data is unaffected.

## Device gates and remaining work

No Unity Editor/license, macOS/Xcode or connected iPad is available here. There is no installable iPad binary. Engine compilation and Editor/Play tests, IL2CPP, iOS SQLite linkage, signing and real device acceptance are required. iOS __Internal binding needs libsqlite3.tbd linked in UnityFramework. Font availability, keyboard, safe area, touch, control sizing and suspension/resumption must be checked on target.

Unsaved drafts are memory-only and can be lost on forced process termination; committed revisions are durable. Files backup/share UI and local customer/product/project business CRUD remain deferred. Temporary workspace GameObject disable/re-enable is outside current navigation; future navigation must reinitialize interrupted busy/coroutine state.

No backend business code, migration, Admin Web source or JWT behavior was changed. No AI, CAD, VR, quotation or order work was added.

## Execution and publication decisions

The user delegated technical choices, so no document approval menu was requested. The completed managed worktree was reused and older branches preserved. Engine/device acceptance was kept separate from console proof; presentation, font, keyboard, linker and lifecycle corrections may still be necessary before installation.

Native Git publication repeatedly encountered empty replies/timeouts. The GitHub connector mirrored commits with every tree SHA checked; original local commits remain on codex/phase-3-local-scene-ui-source. The final test-source commit used native push successfully. No remote force update was used.

PR #5 already existed against main; it was updated rather than duplicated or retargeted. It includes still-open dependency PRs #2, #3 and #4, so source review should distinguish this step from dependencies. It remains draft and unmerged because Engine/device gates are pending. The worktree and resume ledger remain available. No subsequent stage is claimed complete.
