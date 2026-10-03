# Windows Offline Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and manage durable local sales orders from immutable quotations, with a printable customer-facing document.

**Architecture:** Extend the existing SQLite/LocalSceneStore core with v6 immutable order snapshots plus separately versioned status. Expose narrow actions through the existing C# bridge and loopback Node route; mount a focused order component next to quotations in the Edge client.

**Tech Stack:** C#/.NET Framework 4.8, SQLite, Newtonsoft.Json, Node 24, browser modules, Playwright/Edge.

**Spec:** `docs/superpowers/specs/2026-10-01-windows-offline-orders-design.md`

## Global constraints

- Windows local/offline; no payment, stock allocation, cloud login, CAD, AI layout or model generation.
- Browser cannot submit amount, line items, creator, workspace ID, or order number.
- Orders come only from saved quotation snapshots; no demo-only orders.
- Keep quote branch and PR #10 unchanged; stack new draft PR on `codex/windows-offline-quotations`.

## Review focus

- Repeated or concurrent creation for one quote yields one complete order.
- A failed line insert or status event insert leaves no partial header/status change.
- Cross-workspace or cross-project order IDs cannot be read or changed.
- Product price changes, scene restore, and subsequent quotes cannot mutate old orders.
- Failed order detail loads never leave another order printable.

### Task 1: SQLite v6 and order snapshots

**Files:** `apps/unity-client/Assets/LocalScenes/LocalSceneStore.cs`, `LocalIdentity.cs`, new `LocalOrderStore.cs` and `.meta`, `apps/unity-client/Tests/LocalOrderTests.cs`, test runner and migrated-fixture tests.

**Interfaces:** `CreateOrder(Guid customerId,Guid projectId,Guid quotationId)`, `Order(Guid id)`, `Orders(Guid projectId,int limit,int offset)`, `SetOrderStatus(Guid id,long baseRevision,string status)`.

- [ ] Add failing real SQLite tests for snapshot precision, duplication, scope, migration/backup/rollback, immutable lines and exclusions, status history, fault rollback and independent-connection races.
- [ ] Verify red, add v6 migration and order store using transactions and server-derived snapshots.
- [ ] Run complete `tools/test_offline_core.ps1`, then commit.

### Task 2: Bridge and browser workflow

**Files:** `apps/windows-local/bridge/Program.cs`, `public/orders.mjs`, `public/quotes.mjs`, `public/app.mjs`, `public/index.html`, `public/style.css`, `package.json`, bridge/browser tests.

- [ ] Add failing bridge and real Edge tests for quote→order, 404/409, duplicate submit, print/PDF, restart, network failure and no stale print.
- [ ] Add narrow actions and UI, reusing existing API/security handling and decimal-string formatting.
- [ ] Run targeted then complete Windows tests, syntax and formatting; commit.

### Task 3: Package, independent review, CI

**Files:** `README.md`, `apps/windows-local/README.md`, `docs/windows-local-verification.md`, `tools/package_windows_local.ps1`, real screenshot/PDF evidence.

- [ ] Build clean portable package, test exact package, launcher, license/manifest, and ZIP; document known limits.
- [ ] Request independent review of full branch diff, fix Critical/Important findings with regressions, rerun full suites.
- [ ] Push branch, open stacked draft PR, await exact SHA Windows Local, Scene core and Backend Actions success. Leave PR unmerged.
