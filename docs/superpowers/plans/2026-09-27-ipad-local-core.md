# iPad Local Scene Core Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, task-by-task, with TDD and one whole-branch independent review.

**Goal:** save and restore complete scenes locally without a server.
**Architecture:** native SQLite C API with explicit platform library selection, generated-schema structural validation plus authority-matched geometry/references, transactional scene repository. No Unity UI or backend business changes.
**Tech Stack:** C# compatible with Unity/.NET Framework, Newtonsoft13.0.2, system SQLite; .NET8 CI.
**Spec:** ../specs/2026-09-27-ipad-standalone-offline-design.md
**Authorization:** user delegated technical decisions after confirming standalone offline iPad. Planning and inline execution proceed without further technical-file approvals.

## Global Constraints
- SceneModel1.0.0 / mm / RH_Z_UP stays authoritative; no second DTO protocol.
- No server JWT/authentication; workspace/actor are local provenance only.
- SQLite format version and scene revision are separate from schema_version.
- No customer/product/project UI migration, CAD/AI/VR/uploads/quotation.
- Unity Editor and iOS IL2CPP/device execution absent: never claim those pass from console tests.
- Preserve existing branches; no merges. New branch codex/phase-3-ipad-local.

## Review Focus
- Partial writes or current-pointer advancement after version insert failure.
- Unicode, embedded NUL and JSON integers changing during persistence.
- Same revision writes using genuinely independent SQLite connections.
- Unsupported schema keywords or incomplete geometry silently accepted.
- Existing backup overwritten, active DB copied unsafely, imported provenance trusted.

### Task 1: SQLite transport
Files: Assets/LocalScenes/SqliteConnection.cs, SqliteNative.cs, LocalStoreError.cs; Tests/SqliteTests.cs.
Interfaces: SqliteConnection(path), Execute(sql, params object[]), Query(sql, params object[]), Transaction(Action), BackupTo(newPath), IDisposable.
- [x] Write tests: real DB create/read Unicode + NUL/null/integer; rollback; close/reopen; independent-connection lock/busy; online backup, existing target rejection; safe errors.
- [x] Compile with missing implementation -> expected RED; implement minimal safe native binding -> executable tests GREEN.
- [x] Platform: Windows winsqlite3; Linux/macOS sqlite3; UNITY_IOS non-Editor __Internal. No downloading/embedding unverified binaries. Record iOS linkage pending.
- [x] Commit tested transport.

### Task 2: authoritative offline validation
Files: Core/OfflineSceneValidator.cs, SceneSchemaRules.cs, SceneGeometryRules.cs, SceneReferenceRules.cs; tools/export_offline_validation.py; Tests/ValidationTests.cs; tests/scene/test_offline_validation.py.
Interfaces: OfflineSceneValidator(schemaJson).Validate(sceneJson) -> SceneDocument, throws safe SceneValidationError.
- [x] Generate shared valid/invalid cases from SceneModel; include all collections/constraints and existing geometry edge cases. Expected flags computed by real Pydantic. Capture missing validator RED.
- [x] Validate generated schema keywords fail-closed; finite numbers, UUID canonicalization, required/extra fields, nested metadata. Preserve exact integer metadata.
- [x] Port semantic geometry tolerance0.001mm, normalized polygons, references, openings and global uniqueness; compare every case to Python.
- [x] Keep client preflight separate; fix BigInteger preservation through a regression first.
- [x] Commit generation/tests and validator separately.

### Task 3: transactional scene library
Files: LocalSceneStore.cs, LocalSceneVersion.cs; Tests/LocalStoreTests.cs.
Interfaces: LocalSceneStore(path,workspace,actor,validator), Create(name)->Guid, Put(document,baseRevision,json), Restore(document,baseRevision,revision), Current(document), Versions(document,limit,offset), Catalog(productId,name,dimensions), BackupTo(newPath), ExportVersion(document,revision).
- [x] RED tests for first/update/read/history pagination/restore/reopen; stale base; actor from context; product reference; workspace/document isolation.
- [x] Real independent-connection thread races: first save, update/restore. One success; other safe conflict or busy requiring retry; no lost writes/duplicate versions.
- [x] BEGIN IMMEDIATE plus conditional pointer update and unique history; DB triggers forbid UPDATE/DELETE on historical rows. FKs scope workspace.
- [x] Test injected database trigger abort after history insert -> rollback; invalid/corrupt history revalidation; backup opens with all versions.
- [x] Commit tested repository.

### Task 4: evidence and independent review
Files: LocalScenes asmdef/metas, Tests/OfflineTests.csproj, scene-consumer workflow, README, docs/phase-3-2a-verification.md.
- [x] .NET CI executes same production sources on real SQLite; shared fixtures and schema copies drift check; retain prior consumer/backend checks.
- [x] Full applicable regression, Ruff, schema/OpenAPI/sample checks; whole-branch independent review and TDD fixes.
- [x] Small commits and push new branch; exact-SHA CI evidence; dependent draft PR only, never merge.
- [x] Record console vs Unity/iPad unrun evidence; stop after local core.
