# Windows DXF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a trustworthy two-dimensional DXF floor plan into a Windows-local project as a validated, saveable SceneModel draft.

**Architecture:** A dedicated Node worker reads bounded DXF bytes and returns normalized 2D primitives. A browser module converts selected layers and a confirmed millimeter scale into SceneModel, then uses the existing local bridge for validation and immutable version saving. The original file is archived under a server-generated SHA-256 name.

**Tech Stack:** Node 24, `dxf-parser@1.1.2` (MIT), browser ES modules, existing C# SceneModel validator and SQLite store, `node:test`, Playwright/Edge.

**Spec:** `docs/superpowers/specs/2026-10-05-windows-dxf-import-design.md`

## Global Constraints

- Windows local portable app remains fully offline after packaging; no cloud API or Python runtime.
- All SceneModel lengths are finite millimeters in RH_Z_UP coordinates; existing schema is authoritative.
- DXF limit: 8 MiB; worker timeout: 5 seconds; supported primitive limit: 20,000.
- Accept text DXF only. Unknown units require manual calibration; known units require user confirmation.
- Never overwrite a saved scene or discard a dirty draft on failure.
- Imported wall thickness defaults to 200 mm and floor height to 2800 mm; label both as estimates.

## Review Focus

- A unitless DXF should require known-length calibration before conversion (Task 2 test).
- A clockwise, self-intersecting, or duplicate-vertex room must not silently yield an invalid saved scene (Task 2 test and bridge validation in Task 4).
- Oversized, malformed, or slow DXF input must not block or expose the local service (Task 1 and Task 3 tests).
- Origin/cookie/Host restrictions must also protect the two new upload routes (Task 3 tests).
- A failed import must retain the existing unsaved scene draft (Task 4 browser test).

---

### Task 1: Bounded DXF analysis

**Files:**
- Create: `apps/windows-local/dxf-worker.mjs`, `apps/windows-local/dxf-analyze.mjs`, `apps/windows-local/tests/dxf-analyze.test.mjs`
- Modify: `apps/windows-local/package.json`, `apps/windows-local/package-lock.json`

**Interfaces:**
- Produces: `analyzeDxf(bytes: Uint8Array) -> Promise<{unitsCode, layers, segments, closedPaths, skipped, sha256}>`.
- `segments` contain `{layer,start:{x,y},end:{x,y}}`; `closedPaths` contain `{layer,points:[{x,y}]}`. Numbers must be finite.

- [ ] Add fixture-based tests for LINE, straight LWPOLYLINE/POLYLINE, closed paths, `$INSUNITS=4`, unsupported bulge/block counts, invalid UTF-8, binary DXF, zero geometry and the 20,000 primitive cap.
- [ ] Run `node --test apps/windows-local/tests/dxf-analyze.test.mjs`; confirm failure is the missing analyzer.
- [ ] Add locked `dxf-parser@1.1.2`; implement `analyzeDxf` through a worker with a 5-second termination timer and normalized result. Do not trust parser object fields without finite/range checks.
- [ ] Rerun the focused test and `node --check` for both new modules; commit `feat: analyze bounded local DXF geometry`.

### Task 2: Scale calibration and SceneModel conversion

**Files:**
- Create: `apps/windows-local/public/dxf-scene.mjs`, `apps/windows-local/tests/dxf-scene.test.mjs`

**Interfaces:**
- Produces: `suggestMmPerUnit(unitsCode: number) -> number | null`, `calibrateMmPerUnit(segment, actualLengthMm: number) -> number`, `buildDxfScene(analysis, options) -> SceneModel`.
- `options` contains `{roomLayer, wallLayer, mmPerUnit, sourceSha256, wallThicknessMm:200, floorHeightMm:2800}`. Caller supplies UUID generator for deterministic tests.

- [ ] Add tests for mm/cm/m unit suggestions, unitless refusal, 4200 mm calibration from a 4.2-unit line, positive scale bounds, coordinate translation, CCW room direction, duplicate wall edge removal, unclosed-room refusal and unsupported bulge refusal.
- [ ] Run `node --test apps/windows-local/tests/dxf-scene.test.mjs`; confirm the new behavior fails before code.
- [ ] Implement pure conversion without any I/O. Generate one floor, validated rooms and walls, empty unsupported collections, and source/assumption metadata. Reject non-finite and degenerate geometry.
- [ ] Rerun focused tests and existing `scene-tools` tests; commit `feat: convert calibrated DXF rooms to SceneModel`.

### Task 3: Protected local upload and source archive

**Files:**
- Modify: `apps/windows-local/server.mjs`, `apps/windows-local/tests/server.test.mjs`

**Interfaces:**
- `POST /api/dxf/analyze`: raw DXF, returns bounded analysis; `POST /api/dxf/archive`: raw DXF, returns `{sha256}` after atomic archive under `floorplans/<sha256>.dxf`.
- Both require exact loopback Host, valid local cookie, same Origin and DXF content type. Client names and paths never become server paths.

- [ ] Add HTTP tests for successful analyze/archive and idempotent reupload, cross-origin/missing-cookie rejection, wrong type, 8 MiB boundary, malformed DXF, worker timeout and safe Chinese errors.
- [ ] Run `node --test apps/windows-local/tests/server.test.mjs`; confirm new-route tests fail for missing routes.
- [ ] Implement bounded streaming, SHA-256, worker call, atomic archive and no-store responses; ensure only the source bytes enter the archive.
- [ ] Rerun server tests and `node --check apps/windows-local/server.mjs`; commit `feat: receive and archive local DXF safely`.

### Task 4: Import preview and project draft

**Files:**
- Create: `apps/windows-local/public/dxf-import.mjs`
- Modify: `apps/windows-local/public/index.html`, `apps/windows-local/public/style.css`, `apps/windows-local/public/app.mjs`, `apps/windows-local/tests/browser.spec.mjs`

**Interfaces:**
- `mountDxfImport({api, getActive, hasUnsavedChanges, setDraft, notify})` handles file selection, layer choice, preview line selection, scale confirmation and import. `setDraft` validates through existing `api("validate")` before replacing the current draft.

- [ ] Add a browser test with a real DXF fixture: select project/scene, preview layers, confirm mm scale, import, see rendered rooms, save v1, reopen. Add tests for unitless calibration and failed import retaining a dirty draft.
- [ ] Run `node --test apps/windows-local/tests/browser.spec.mjs`; confirm the new UI assertions fail for missing controls.
- [ ] Implement the preview and controls; archive only on confirmation, compare returned SHA with analysis SHA, build and validate SceneModel, then replace draft. Keep user choice and error messages in Chinese.
- [ ] Rerun browser tests, all Windows-local tests, check/format/build, and commit `feat: import DXF into local design project`.

### Task 5: Package and acceptance

**Files:**
- Modify: `apps/windows-local/README.md`, `README.md`, `docs/windows-local-verification.md`, `tools/package_windows_local.ps1`

- [ ] Add a package test asserting DXF worker and parser dependency are included and import still runs with the network disabled.
- [ ] Run it red, update package script, run green. Document supported entities, calibration, estimated wall dimensions, backups and failure cases.
- [ ] Run the complete Windows-local suite, Node syntax/format checks, a clean portable package and real Edge/SQLite smoke test. Record exact commands, counts and limitations; run whole-branch review and fix important findings with a failing regression test first.
- [ ] Commit `docs: verify offline DXF import` and publish a draft PR stacked on `codex/windows-offline-room-materials` after verifying remote state.
