# Phase 3-2A local core execution ledger

Plan: docs/superpowers/plans/2026-09-27-ipad-local-core.md
Spec: docs/superpowers/specs/2026-09-27-ipad-standalone-offline-design.md
Base: cc224ae9f984d793812e488578e4cec82118c6d2. Native separate worktree, branch codex/phase-3-ipad-local.
User delegated technical choices and execution; no further requests to review technical files.

Pre-flight: Task1 produces SqliteConnection consumed by Task3; Task2 produces validated SceneDocument consumed by Task3. Backup implementation belongs to Task1, store only delegates.
Ruling: execute inline, preserve existing source and PRs; isolate the new local core. Cost if wrong: new core can be removed without affecting Phase2/3-1.
Ruling: SQLite direct static C API bindings avoid introducing an untested reflection-heavy AOT provider. Windows system SQLite and Linux native SQLite will run actual tests; iOS __Internal linker and IL2CPP remain pending real toolchain. Cost if wrong: replace provider behind connection boundary.
Ruling: no production writes until complete validator exists; transport tests use a separate toy table, not a pretend valid scene.

Unity Editor/compiler/Play/iOS build/iPad acceptance: NOT RUN (environment unavailable). No new test or CI success claimed yet.
