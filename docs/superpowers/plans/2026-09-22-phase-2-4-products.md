# Phase 2-4 Product Management Implementation Plan

**Goal:** Fix customer money/pagination regressions and deliver authenticated product list, search/filter, create, detail, and edit flows.

**Architecture:** Move decimal-string formatting to a shared display helper. Keep 20-row server pagination. Extend FastAPI product listing with tenant-scoped PostgreSQL `search` and exact `category`; extend the existing Next.js API client and BFF without exposing JWT. Product forms preserve price strings, validate positive dimensions, and parse metadata JSON before submission.

1. Add failing browser regression assertions for decimal money and a genuine 21-customer second page. Fix shared money formatting and production page size; run customer tests and commit.
2. Add failing PostgreSQL tests for product name/SKU/brand search, category, combinations, total, pagination, validation, and tenant isolation. Implement filters, regenerate OpenAPI, run backend tests/Ruff, and commit.
3. Add mock products and failing browser tests for list/null/price/dimensions/pagination/search/category, create validation/JSON/SKU conflict, detail/404, edit, expiry, and JWT absence. Extend `lib/api` and BFF, then implement product pages and forms; commit after green.
4. Run all frontend/backend checks, perform real PostgreSQL/FastAPI/BFF browser integration, document evidence, inspect secrets/diff, push the current branch, and verify GitHub Actions. Do not create a PR or continue to Phase 2-5.

## Verification evidence

### Original Phase 2-4 baseline

- Reviewed SHA: `ee578b415ba084f4f943f90268abc59688ff2348`.
- GitHub Actions reported 33 frontend tests and 298 backend tests with 2 warnings.
- The earlier 295 passed / 3 skipped count below came from the local Windows environment and was not the GitHub Actions result.
- Real browser integration against local FastAPI and PostgreSQL logged in through the BFF, created `三人沙发` (`SOFA-001`) at `6800.50`, observed `¥6,800.50`, updated it to `6999.90`, and confirmed persisted `¥6,999.90` after reload.

### Acceptance fixes

- Fix SHA: `73c60b0d8656a622fd1a2bb987cc2d987380ab9a`.
- Local verification: 41 Playwright tests passed; ESLint, TypeScript strict typecheck, and Next.js production build passed.
- GitHub Actions frontend: 41 passed — [run 35685149065](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35685149065).
- GitHub Actions backend: 298 passed, 2 warnings; Ruff, migrations, generated OpenAPI/Scene contracts, and Docker build passed — [run 35685149084](https://github.com/jhhjhui97-sys/zhinengFamily/actions/runs/35685149084).
- The fixes reject non-finite Metadata recursively in the form and BFF, support arbitrary category text with suggestions, preserve search/category during pagination, keep the original product after an edit SKU conflict, clear an invalid auth cookie, and verify JWT absence from browser storage and product BFF responses.
