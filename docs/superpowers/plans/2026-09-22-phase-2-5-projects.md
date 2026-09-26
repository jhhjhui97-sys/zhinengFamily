# Phase 2-5 DesignProject Admin Implementation Plan

**Goal:** Deliver authenticated project list, create, detail, and edit flows while preserving tenant and assignment rules.

**Architecture:** Reuse the existing HttpOnly-cookie BFF and `serverRequest`. Project responses keep customer and sales-user IDs, while Next.js resolves customer information through the existing tenant-scoped Customer API. A client customer picker searches `/api/customers` so customers beyond the first page remain selectable. Creation omits `sales_user_id` so FastAPI assigns the current user; editing preserves the existing assignee because the backend has no tenant user-list endpoint and this phase must not expand user management.

1. Extend backend project tests for pagination, default assignment, owner/sales transfer permissions, and cross-tenant customer/user/project isolation. Do not add backend behavior unless a tested gap is found.
2. Add failing browser tests and mock routes for project list, pagination, customer search beyond page one, create-from-customer, create validation/errors, detail placeholders, edit, 404/401, and JWT absence.
3. Add Project types, API client, BFF routes, customer picker, form, list/new/detail/edit pages, and enable the customer-detail project link. Commit in small BFF/UI/test steps.
4. Run all frontend and backend checks, perform the requested real FastAPI/PostgreSQL flow, document local and CI evidence separately, push, and wait for both GitHub Actions workflows on the latest SHA. Stop before Phase 2-6.

## Local verification

- Admin Web tests: 49 passed.
- Admin Web lint, TypeScript typecheck, and production build: passed.
- Backend pytest on Windows: 296 passed, 3 skipped, 2 warnings. The skipped tests are Linux-only checks that run in CI.
- Backend Ruff check and format check: passed.
- SceneModel contract and OpenAPI contract checks: passed.
- Real FastAPI/PostgreSQL integration: passed. Using the browser and the secure BFF flow, created customer `张先生`, opened the customer detail, created project `龙湖小区120㎡`, confirmed it appeared in the project list, edited it to `龙湖小区120㎡深化设计` with status `active`, refreshed the detail page, and confirmed the changes persisted.

## GitHub Actions

Verified implementation SHA: `63c83e00c79cce509ebae4f9004a421ce59a3559`.

- [Admin Web Actions](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35691273046): success; job log confirms **49 passed**. Lint, typecheck, and production build passed.
- [Backend Actions](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35691273050): success; job log confirms **299 passed, 2 warnings**. Ruff, formatting, Alembic migration, generated OpenAPI/Scene contracts, and Docker build passed.
- These are actual Linux CI results, separate from the Windows local results above. This evidence-only documentation update is also subject to both workflows after push; its final status is reported in the task handoff.

## Customer picker acceptance follow-up

- Review baseline: `63c83e00c79cce509ebae4f9004a421ce59a3559`; remote SHA verified through the GitHub API before committing this follow-up. Preserved local evidence commit `683e4000cc8f1afe653ac08aa7503979cbf49986`.
- TDD: added eight regression scenarios, observed all eight fail before the component fix. After the fix, the full local Windows/Edge suite passed: **57 passed**. `npm run lint`, `npm run typecheck`, and `npm run build` passed.
- Tests cover 401 after successfully opening both new/edit project pages (real BFF cookie clearing against mock upstream), 403/503/network failures with Chinese retry feedback, no stale selectable results, empty-success distinction, and out-of-order completion without overwriting current loading/results. Existing customer/product/project regressions remain in the full suite.
- Browser tests use mock FastAPI and deliberate browser network faults; they do not constitute a new real PostgreSQL integration run. The earlier real integration evidence above remains scoped to its original implementation. No Python backend or API contract changed in this follow-up.
- Root and admin READMEs now describe implemented customer/product/project management and the remaining SceneModel persistence/version limitations.
- Verified follow-up SHA: `0f485f965d6d142577d44363217c88ba1ae8f092`. [Frontend Actions](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35713156751) succeeded with **57 passed**, lint/typecheck/build passed. [Backend Actions](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35713156963) succeeded. These runs verify the new customer-picker implementation, separately from the baseline. The subsequent evidence-only documentation commit is checked again before handoff.

## Scope and limitations

- The project API and backend business behavior are unchanged; backend changes add permission and pagination regression tests.
- Sales assignment defaults to the authenticated user. The UI preserves the existing assignee on edit and displays the returned user ID; no user directory or transfer selector was added. Existing owner/sales transfer permissions are covered by PostgreSQL tests.
- SceneModel, version history, and product lists remain placeholders, and the 3D entry is disabled as required for this phase.
