# Windows Offline Quotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows-local seller can generate, inspect and print an immutable quotation from a saved customer-project scene version without losing monetary precision.

**Architecture:** Extend the existing SQLite/C# `LocalSceneStore` with v5 quotation snapshots. Reuse the Node loopback `/api/local` route, bridge allowlist and Edge design workspace. Keep workspace identity entirely server-side and render stored monetary strings without JavaScript arithmetic.

**Tech Stack:** SQLite native C API, C# LocalScenes, Newtonsoft JSON, Node 24, Three.js browser UI, real Edge Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-windows-offline-quotations-design.md`

## Global constraints

- Windows 10/11 offline; no FastAPI, cloud service, Mac or new runtime.
- All writes use authenticated local loopback session and same-origin protection.
- Existing SceneModel and scene history remain immutable.
- Product prices are decimal strings; all arithmetic uses decimal/integer cents in C#, never JS float.
- No order/payment features in this plan.

## File map

- `apps/unity-client/Assets/LocalScenes/LocalSceneStore.cs`: v5 migration and recovery backup.
- `apps/unity-client/Assets/LocalScenes/LocalQuotationStore.cs` + `.meta`: create/read/list immutable quote snapshots.
- `apps/unity-client/Tests/LocalQuotationTests.cs`, `OfflineTests.cs`, `OfflineTests.csproj`, `tools/test_offline_core.ps1`: real SQLite behavior and migration tests.
- `apps/windows-local/bridge/Program.cs`: scoped quotation actions and safe output.
- `apps/windows-local/public/quotes.mjs`, `app.mjs`, `index.html`, `style.css`: project quotation UI and print view.
- `apps/windows-local/tests/browser.spec.mjs`, `bridge.test.mjs`: real Edge, bridge, restart and negative cases.
- `apps/windows-local/README.md`, `docs/windows-local-verification.md`, packaging instructions: user-facing limits and evidence.

## Task 1 — v5 persistence and precision

- [ ] Add failing real SQLite tests for migration, backup, rollback, scene/product ownership, exact cents, grouping, demo exclusions, immutable snapshots and restart.
- [ ] Observe red test result from missing v5 quotation API.
- [ ] Add v5 tables and atomic migration, then quote create/read/list with decimal arithmetic and server-generated identity.
- [ ] Run complete offline core suite; commit.

## Task 2 — local bridge and browser workflow

- [ ] Add failing bridge and real Edge tests for create/list/detail, unsaved-scene guard, old-price snapshot, demo exclusion, print, reload, cross-scope, safe errors and no token storage.
- [ ] Reuse existing `/api/local` and C# bridge; add only quotation actions to allowlists and input validation.
- [ ] Build UI module with busy/error states; update design workspace and print CSS.
- [ ] Run focused and complete browser tests; commit.

## Task 3 — package, review and remote evidence

- [ ] Update local docs and package instructions; avoid calling a product subtotal a tax-inclusive final invoice.
- [ ] Request independent reviewer and fix Critical/Important findings.
- [ ] Run full real SQLite suite, packaged Node/Edge tests, syntax/format and launcher smoke test.
- [ ] Create a clean Windows ZIP with source SHA and hash; visually inspect actual print and app screenshots.
- [ ] Push current branch, create stacked draft PR and wait exact-head Windows, scene-core and backend Actions success. Keep PR open and do not merge.
