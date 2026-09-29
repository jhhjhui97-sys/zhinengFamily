# Windows Offline SKU Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a real local GLB for a sellable SKU, place that SKU in an offline project scene and preserve the exact asset used by each scene version.

**Architecture:** Content-addressed GLB files live under app data. SQLite v4 stores immutable asset metadata and the product's active asset; SceneModel's existing `asset_id` pins the model per furniture instance. The same loopback server and C# bridge validate imports, ownership and scene saves.

**Tech Stack:** Windows .NET Framework bridge + SQLite, Node loopback, Edge/Three.js, existing SceneModel.

**Spec:** `docs/superpowers/specs/2026-09-29-windows-sku-models-design.md`

## Global Constraints

- Offline Windows 10/11, no cloud or runtime developer toolchain.
- GLB v2 only, maximum 30 MiB, no external resource URIs or user-controlled filesystem paths.
- Both product and asset workspace ownership are validated server-side; client never supplies workspace/actor.
- Historical SceneModel JSON and referenced asset files remain immutable.
- Four bundled models remain clearly marked demos, not mapped to arbitrary SKUs.

## Review Focus

- A malformed or external-URI GLB must not leave a committed product-to-model pointer.
- Replacing a SKU's active model must not change the model used by an older saved scene version.
- Missing model bytes must be reported, not counted as successfully rendered furniture.
- Two concurrent attach attempts with the same product revision: only one succeeds.
- Database backup without the models directory is incomplete; documentation must explicitly say so.

---

### Task 1: SQLite v4 model metadata and scene pinning

**Files:** `LocalSceneStore.cs`, `LocalProductStore.cs`, new `LocalModelAssetStore.cs` and `.meta`, `LocalIdentity.cs`, C# test runners and new tests.

- [ ] Write failing real SQLite tests for fresh/v1/v2/v3→v4 upgrades, pre-v4 backup restore, rollback and existing data retention.
- [ ] Write failing tests for attach CAS, workspace/product ownership, immutable asset rows, old scene asset pinning and cross-product forged `asset_id` rejection.
- [ ] Add v4 migration, model metadata methods and scene-validation check using existing SceneModel `asset_id`; compile and pass focused tests.
- [ ] Run full offline core and commit.

### Task 2: Safe GLB import and loopback serving

**Files:** `apps/windows-local/server.mjs`, a focused `glb.mjs`, `bridge/Program.cs`, Node bridge/server tests.

- [ ] Write failing tests for valid textured GLB, bad magic/length/JSON, external URI, too-large upload, same-origin/cookie, traversal, stale revision, cross-product ownership, failed upload preserving current model, missing file and restart.
- [ ] Add bounded streaming upload to a temp file, SHA-256 naming and atomic final placement; call bridge to link only after verifying file/hash and product revision.
- [ ] Add protected UUID asset GET route; do not expose arbitrary app-data files. Map failures to safe Chinese errors.
- [ ] Pass focused and full bridge/server tests; commit.

### Task 3: Product-to-scene browser flow

**Files:** `public/products.mjs`, `index.html`, `style.css`, `app.mjs`, `scene-tools.mjs`, `renderer.mjs`, real Edge tests.

- [ ] Write failing browser tests: import a real bundled GLB into a SKU, catalog availability, place in selected room, save v1, replace SKU model, save v2, reopen v1 and confirm pinned model; invalid file and 409 preserve state; restart persists; no browser storage; 1024px layout.
- [ ] Show model status and a local-file upload control on product detail; refresh scene catalog on returning to design.
- [ ] Include only model-backed SKUs in scene catalog, set `asset_id` on placement, load that asset from the local model route, and show partial/missing load honestly.
- [ ] Run focused real Edge tests, format/check and commit.

### Task 4: Delivery and independent review

**Files:** root and client README, Windows verification record, package instructions, actual screenshot.

- [ ] Update docs to explain `.glb` requirements, licensing, complete app-data backup, four demo models and remaining product realism limitations.
- [ ] Run full core/client source and exact-source bundle tests, ZIP hash verification, extracted-launcher smoke and secret scan.
- [ ] Dispatch one independent read-only review (Superpowers requesting-code-review); fix Critical/Important findings, rerun relevant/full checks and commit.
- [ ] Push `codex/windows-sku-models`, create a draft PR based on `codex/windows-offline-products`, attach it and verify exact-head Windows/core/backend Actions; leave it unmerged.
