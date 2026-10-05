# Windows Sales Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Windows customer cleanup, direct 3D furniture adjustment, and photo-plus-dimensions proxy models usable offline.

**Architecture:** Extend the SQLite store and C# bridge for reversible customer removal; keep furniture gesture logic in a focused browser module backed by shared geometric validation; generate small self-contained GLB assets locally and attach them through the existing model upload path.

**Tech Stack:** C#/.NET Framework 4.8, SQLite, Node 24, Three.js, Playwright/Edge, SceneModel.

**Spec:** `docs/superpowers/specs/2026-10-05-windows-sales-usability-design.md`

## Global Constraints

- Offline only; no cloud model service or account requirement.
- Scene length units are millimetres.
- Existing quotations, orders, scene versions, and model asset history stay immutable.
- Never hard-delete linked customer data.
- A generated model is explicitly labeled approximate.

## Review Focus

- Existing v6 database upgrades without losing customer/project relationships.
- Concurrent customer edits versus deletion return conflict without hiding data.
- Unusual room shapes and rotated furniture cannot cross boundaries or overlap.
- Invalid or oversized images cannot replace the current product model.
- Packaged runtime includes every module needed for offline generation and interaction.

---

### Task 1: Reversible customer removal

**Files:** `apps/unity-client/Assets/LocalScenes/LocalSceneStore.cs`, `LocalSalesStore.cs`, `apps/windows-local/bridge/Program.cs`, `apps/windows-local/public/app.mjs`, `index.html`, `apps/unity-client/Tests/LocalStoreTests.cs`, `apps/windows-local/tests/browser.spec.mjs`.

- [ ] Write failing store and browser tests for remove/restore, v6 migration, linked records, revision/phone conflicts.
- [ ] Verify failures; implement v7 migration and scoped store/bridge actions.
- [ ] Add customer controls and preserve selection/draft handling.
- [ ] Run focused tests, then Windows CI; commit.

### Task 2: Direct furniture manipulation

**Files:** `apps/windows-local/public/renderer.mjs`, `app.mjs`, `scene-tools.mjs`, new focused gesture module if needed, `index.html`, `style.css`, `tests/scene-tools.test.mjs`, `tests/browser.spec.mjs`.

- [ ] Write failing boundary, collision, selection, middle-drag and right-rotate tests.
- [ ] Verify failures; implement shared geometry rules and raycast gesture adapter.
- [ ] Test visual selection, wall distance, dirty state, invalid drop and version save.
- [ ] Run focused tests and Windows CI; commit.

### Task 3: Photo and dimensions proxy model

**Files:** new `apps/windows-local/public/photo-model.mjs`, `products.mjs`, `index.html`, `style.css`, `tests/photo-model.test.mjs`, `tests/browser.spec.mjs`, `tools/package_windows_local.ps1`, `apps/windows-local/README.md`.

- [ ] Write failing tests for generated embedded-image GLB, exact dimensions, invalid image and preservation of prior asset.
- [ ] Verify failures; implement local category primitives and GLB generation.
- [ ] Reuse existing upload/asset version path and show honest approximate labeling.
- [ ] Run focused tests and full Windows CI, review branch, commit and open reviewable PR.
