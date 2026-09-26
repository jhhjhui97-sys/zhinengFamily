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
## Final independent review and local verification (2026-09-27)

Fresh read-only reviewer inspected cc224ae..c62a8de. Critical 0; Important 3; Minor 1. Regraded UUID compatibility to Important because an invalid import passing the authoritative validator is a contract defect. Four findings fixed in one TDD pass: unpaired surrogate mutation, BigInteger geometry conversion, malformed protocol header exceptions, and .NET-only UUID representations. Regression run first showed six failures; after fixes all seven focused scenarios passed. No deferred Minor.

Final: Ruling: UUID mismatch is Important, not polish — offline protocol compatibility is required — cost if wrong: narrower UUID import accepted only in authority-verified forms.
Final: Ruling: Unity Editor/iOS/IL2CPP/device execution remains explicitly unverified — unavailable toolchain — cost if wrong: native provider/linker or AOT adjustments before device delivery.
Final: Ruling: viewer integration, Files UI and business CRUD remain next steps — bounded core stage — cost if wrong: usable iPad UI takes an additional stage.
Final: Ruling: exact-SHA CI is a publication gate, not replaced by review — only actual runs count — cost if wrong: delivery is delayed until checks finish.

Actual local evidence:
- Production C# compiled into separate Core and LocalScenes assemblies, then console tests: 7 real SQLite transport + 256 authority comparison/schema checks + 11 scene store scenarios + 7 review regressions = 281 checks. Four race classes repeated six times, genuine independent native connections/threads.
- Existing coordinate/JSON consumer: 19 + 9 passed. No Unity Engine compile/execution inferred.
- Full PostgreSQL backend pytest: 331 passed, 3 Windows filesystem skips, 2 existing deprecation warnings. Initial old port55432 was unavailable; initial unconfigured run failed. Fresh dedicated PostgreSQL16 loopback55437 with ASCII runtime/data path resolved Windows initialization failure; final reviewed run log .local/final-reviewed-backend-tests.log is green. No business DB or backend source changes.
- Ruff check and format: passed (79 Python files). Alembic upgrade/current: existing 0002 head; no backend migration added.
- SceneModel/OpenAPI contracts and sample/offline fixture drift: passed.
- Unchanged Admin Web tree 83cb3bc76b1374e70b50ab49bacbdb59bac4e9da verified identical in old checkout and new branch. Local Windows/Edge browser test 81 passed using mock FastAPI; lint/typecheck/build passed. Not standalone iPad UI or real iPad integration.
- Local Docker config/build NOT RUN: Docker CLI unavailable. Backend CI must verify those against the new SHA.
- Unity Editor, Play, IL2CPP, Xcode, iPad install/launch/lifecycle/Files/backup acceptance NOT RUN. No installable App delivered yet.

CI: pending new publication. Prior SHA success is historical only. Exact new SHA/run links will be recorded after actual completion in the dependent draft PR and evidence update.
