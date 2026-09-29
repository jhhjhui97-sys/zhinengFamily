# Windows Offline Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable real sellable-product CRUD/search in the Windows offline app without confusing those records with bundled demo 3D models.

**Architecture:** Add SQLite v3 `local_products` to the existing `LocalSceneStore` and expose it through the existing C# bridge. Add a separate product view using the same loopback API; retain the existing scene editor unchanged. Product price remains a decimal string throughout.

**Tech Stack:** C#/.NET Framework bridge and SQLite, Node loopback, browser ES modules, real Edge tests.

**Spec:** `docs/superpowers/specs/2026-09-29-windows-offline-products-design.md`

## Global Constraints

- Windows 10/11 offline; no FastAPI/PostgreSQL or internet at runtime.
- Existing customer/project/scene data and immutable history must survive every migration.
- `workspace_id`, product `id`, and actor are server-generated; no local browser token storage.
- Four bundled models are labeled demo assets, never assumed to be actual SKUs.

## Review Focus

- Existing v1 database upgrading directly to v3 must retain a usable pre-v2 and pre-v3 backup.
- `1e400` at any depth in metadata must fail before `JSON.stringify` can replace it with null.
- Searching a different workspace must never reveal its SKU or count.
- Stale edit/duplicate SKU must not overwrite saved product data or clear form input.
- Search and category filters must remain in force when paging.

---

### Task 1: SQLite v3 migration and product store

**Files:** Modify `apps/unity-client/Assets/LocalScenes/LocalSceneStore.cs`, `LocalIdentity.cs`; create `LocalProductStore.cs` and `.meta`; create `apps/unity-client/Tests/LocalProductTests.cs`; modify both C# test runners.

**Interfaces:** `LocalProducts(limit,offset,search,category) -> LocalProductPage`, `CreateLocalProduct(...) -> LocalProduct`, `LocalProduct(id) -> LocalProduct`, `UpdateLocalProduct(id,baseRevision,...) -> LocalProduct`.

- [ ] Add failing real SQLite tests for fresh/v2/v1 upgrades, pre-v3 backup restore, rollback, CRUD, money string, SKU, isolation, filters, pagination and stale edit.
- [ ] Run the focused tests and confirm red.
- [ ] Implement the v3 transaction and store methods; update LocalIdentity format and workspace scan.
- [ ] Run focused and full offline core suites; commit.

### Task 2: Bridge actions and JSON safety

**Files:** Modify `apps/windows-local/bridge/Program.cs`; extend `apps/windows-local/tests/bridge.test.mjs`.

**Interfaces:** `products`, `product_create`, `product`, `product_update` through existing `/api/local`.

- [ ] Add failing bridge tests for real SQLite CRUD, search/category, 409/404/422, malicious identity fields and metadata overflows.
- [ ] Run focused bridge tests and confirm red.
- [ ] Add bridge actions, use store methods and safe JSON validation; keep all replies Chinese and internal-error-free.
- [ ] Run bridge and offline-core tests; commit.

### Task 3: Browser product management

**Files:** Modify `apps/windows-local/public/index.html`, `style.css`, `app.mjs`; create `products.mjs`, `money.mjs`; extend `apps/windows-local/tests/browser.spec.mjs` and focused module tests.

**Interfaces:** `mountProducts({api, navigate})` renders page state and CRUD; `formatMoney(string|null)` formats without floating point.

- [ ] Add failing real Edge tests for list, form, search/filter/paging, edit, conflict preservation, metadata validation, 1024px layout, restart persistence and no browser token.
- [ ] Run focused tests and confirm red.
- [ ] Build the separate product view and navigation, reusing the existing loopback API; keep demo-model labeling visible.
- [ ] Run focused tests, format/check; commit.

### Task 4: Full delivery verification

**Files:** Update `README.md`, `apps/windows-local/README.md`, `docs/windows-local-verification.md`, package instructions and real screenshot.

- [ ] Run full C# offline core, Windows npm test/format/check and exact-source portable build; test packaged Edge flow, backup restore, manifest hashes and ZIP.
- [ ] Request one independent read-only branch review; fix Critical/Important findings and rerun required checks.
- [ ] Push `codex/windows-offline-products`, create a draft PR based on `codex/windows-offline-sales`, attach it and verify exact-head GitHub Actions. Do not merge PR #3–#8 or claim a full MVP.
