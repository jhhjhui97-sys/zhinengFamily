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

GitHub Actions evidence will be recorded only after the implementation commits are pushed and both workflows finish for the exact pushed SHA.
