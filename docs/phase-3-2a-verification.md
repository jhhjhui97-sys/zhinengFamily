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
`nTask 1: RED NotImplementedException observed; GREEN real Windows SQLite, 7 passed. Unicode/NUL/int64, rollback, separate connection contention, backup/reopen and safe errors. Task scripts require Bash, absent in bundled Git; equivalent brief/ledger maintained directly.
`nTask 2: RED complete valid scene rejected by missing validator; RED 401-digit integer rejected by existing Json.NET reader. Root cause confirmed native reader digit cap, plus double conversion. Added strict JSON parser retaining BigInteger, schema/geometry/reference validation. GREEN 238 C# cases incl unsupported keyword; 2 Python fixture drift tests; prior 19 coordinate + 9 JSON cases pass. Duplicate keys deliberately rejected as stricter import policy; 8MiB/128-depth resource limits retained.
`nTask 3: RED unimplemented repository observed; GREEN 11 real SQLite scenarios. Four race classes each repeated six times on synchronized threads and independent connections (first/update/mixed restore/restore). One succeeds, one Conflict, history/current remain atomic. Rollback fault injection and corrupted-history restore rejected; backup reopened with all revisions. BEGIN IMMEDIATE, CAS pointer, unique version/FKs and immutable triggers implemented.
