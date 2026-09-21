# Phase 2-3 Customer Management Implementation Plan

**Goal:** Sales staff can list, search, create, inspect, and edit real customers through the authenticated admin.

**Architecture:** Add a bounded `search` query to the existing FastAPI customer listing, retaining merchant filtering and `limit/offset`. Extend the existing Next.js server API client with customer methods and same-origin BFF route handlers. Server pages load authenticated data; client forms submit through the BFF. JWT remains only in the HttpOnly cookie and Next server.

**Scope:** Current `codex/phase-2-admin-scene` only. No product/project CRUD, SceneModel, PR, or merge.

1. **Backend search:** Add failing PostgreSQL pytest cases for name/phone/wechat matching, total/pagination, length validation, and merchant isolation. Implement a small conditional predicate in customer listing. Run relevant pytest, Ruff, and OpenAPI check; commit.
2. **Customer BFF:** Add failing Playwright tests using the mock upstream for authenticated list/detail/create/update, 401/403/404/409/422, cross-merchant 404, and no JWT in browser responses. Extend `lib/api`, add `/api/customers` and `/api/customers/[id]`; run tests green; commit.
3. **Customer UI:** Add failing browser tests for list/null/budget/pagination/search/empty state, create/validation/error, detail/404, edit/validation. Implement shared status/format helpers, list, detail, and forms; run tests green; commit.
4. **Verification:** Run full `npm test`, lint, typecheck, build, backend pytest/Ruff and contract checks. Attempt real FastAPI/PostgreSQL flow when services exist; record limitations. Review secrets and diff, commit docs, push same branch, verify Actions.

**Contract:** `CustomerRead` has id, merchant_id, created_at, updated_at, name, owner_user_id, nullable phone/wechat/source/address/budget/notes/last_follow_up_at, and status. `budget` is a decimal string. No customer response includes owner name; show owner_user_id. `CustomerCreate` defaults owner to actor; PATCH preserves authorization on owner transfer. Missing values display `—`.

## Verification record

- TDD red: customer search initially returned all three local customers instead of two matches; the initial customer browser test could not find the real list entry. Both passed after implementation.
- Frontend: `npm test` 26 passed; lint, typecheck, and production build passed.
- Backend on isolated PostgreSQL: full pytest 288 passed, 3 Windows platform skips, 2 dependency deprecation warnings; Ruff and OpenAPI drift checks passed.
- Real integration: started PostgreSQL, migrated the development database, provisioned a temporary merchant/owner, and used Edge through the real Next.js BFF and FastAPI to log in, create 张先生, find the customer in the list, open details, change budget from ¥80,000 to ¥98,000, log out, and confirm `/dashboard` redirects to login.
- Real integration exposed a startup-only SQLAlchemy model registration defect hidden by test fixtures. A subprocess regression test now verifies that importing the application registers all five database models.
