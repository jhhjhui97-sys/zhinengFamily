# Phase 2-4 Product Management Implementation Plan

**Goal:** Fix customer money/pagination regressions and deliver authenticated product list, search/filter, create, detail, and edit flows.

**Architecture:** Move decimal-string formatting to a shared display helper. Keep 20-row server pagination. Extend FastAPI product listing with tenant-scoped PostgreSQL `search` and exact `category`; extend the existing Next.js API client and BFF without exposing JWT. Product forms preserve price strings, validate positive dimensions, and parse metadata JSON before submission.

1. Add failing browser regression assertions for decimal money and a genuine 21-customer second page. Fix shared money formatting and production page size; run customer tests and commit.
2. Add failing PostgreSQL tests for product name/SKU/brand search, category, combinations, total, pagination, validation, and tenant isolation. Implement filters, regenerate OpenAPI, run backend tests/Ruff, and commit.
3. Add mock products and failing browser tests for list/null/price/dimensions/pagination/search/category, create validation/JSON/SKU conflict, detail/404, edit, expiry, and JWT absence. Extend `lib/api` and BFF, then implement product pages and forms; commit after green.
4. Run all frontend/backend checks, perform real PostgreSQL/FastAPI/BFF browser integration, document evidence, inspect secrets/diff, push the current branch, and verify GitHub Actions. Do not create a PR or continue to Phase 2-5.

## Verification evidence

- Frontend Playwright: 33 passed, including all prior authentication and customer tests.
- ESLint, TypeScript strict typecheck, and Next.js production build: passed.
- Backend pytest against PostgreSQL: 295 passed, 3 skipped, 2 dependency warnings.
- Ruff and generated OpenAPI contract check: passed.
- Real browser integration against FastAPI and PostgreSQL: logged in through the BFF, created `三人沙发` (`SOFA-001`) at `6800.50`, observed `¥6,800.50` in the list and detail, updated the price to `6999.90`, reloaded the detail page, and observed persisted `¥6,999.90`.
