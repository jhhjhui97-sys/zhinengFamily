# Phase 2-6 Scene persistence implementation plan

**Goal:** Save validated project scenes and immutable version history; restore creates a new version.
**Architecture:** PostgreSQL scene_versions stores JSONB snapshots. scene_states points to the latest version. Lock the tenant-scoped existing project row with SELECT FOR UPDATE before reading the pointer, checking base_version, and inserting/updating in one transaction. This serializes even first saves. Browser → existing Next.js BFF → FastAPI; JWT remains HttpOnly/server-only.
**Scope:** Current branch only. No 3D editor, Unity, CAD, AI, uploads, quotes or orders. The user explicitly requests a short plan followed by execution.

- [x] Backend TDD: add real PostgreSQL API tests for v1/v2/restore-v3, descending pagination, validation, tenant/product/project isolation, stale versions, rollback, migration preservation and concurrent independent transactions.
- [x] Add Alembic 0002, register SceneState/SceneVersion, and implement five project scene endpoints. GET missing scene returns 200 null; missing project/version returns 404. Strict request bodies are {base_version,scene_data} / {base_version}; history never accepts PATCH/DELETE. Unique project/version and composite tenant foreign keys enforce storage ownership. Restore revalidates the old SceneModel and referenced products.
- [x] Frontend TDD: extend mock upstream and browser tests; add shared scene API/BFF routes and a project-detail scene panel. Include a genuine two-bedroom/living-room example without product references, JSON editor/read-only snapshots, counts, paginated history and restore. Keep draft JSON on errors/conflicts; explicit refresh is required before retrying a stale base version.
- [x] Full local verification: pytest, Ruff, migrations up/down, Scene/OpenAPI exports, frontend test/lint/typecheck/build. Docker is unavailable in this local environment; exact-SHA CI must perform Docker config/build.
- [x] Real PostgreSQL/FastAPI/browser flow: customer → project → v1 → v2 → restore v1 as v3 → refresh and verify all snapshots.
- [ ] Update README/API docs and evidence, small commits, push current branch, verify exact-SHA CI, create/update Phase 2 PR to main and attach it. Do not merge or start the next phase.

Review focus: lock covers scene creation as well as updates; stale restore cannot win; injected history-write failure leaves pointer unchanged; product ownership is checked on restore too; scene_id grants no authority; unsafe JSON/nonfinite values never silently become null; unsaved editor text survives 409/network errors.

## Verification evidence

- Backend local Windows/PostgreSQL: **325 passed, 3 skipped, 2 warnings**. The skipped cases require Windows symlink privilege and run on Linux CI. Scene version subset: 29 passed. Ruff check/format and generated Scene/OpenAPI contract checks passed. Migration round-trip and preservation are covered by passing PostgreSQL tests.
- Admin Web local Windows/Edge: **69 passed** with simulated FastAPI; lint, TypeScript strict typecheck and production build passed.
- Real integration: passed with real PostgreSQL, FastAPI, Next.js BFF and browser. Created a customer and linked project, saved the two-bedroom/living-room sample as v1, changed its title and saved v2, restored v1 as v3, refreshed, confirmed current v3 plus retained v1/v2/v3, and confirmed v2 remained immutable.
- Local Docker: not run because Docker is not installed. GitHub Actions results and exact SHA are deliberately pending until the branch is pushed and those runs finish.
