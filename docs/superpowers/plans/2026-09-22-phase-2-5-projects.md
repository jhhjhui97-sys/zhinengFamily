# Phase 2-5 DesignProject Admin Implementation Plan

**Goal:** Deliver authenticated project list, create, detail, and edit flows while preserving tenant and assignment rules.

**Architecture:** Reuse the existing HttpOnly-cookie BFF and `serverRequest`. Project responses keep customer and sales-user IDs, while Next.js resolves customer information through the existing tenant-scoped Customer API. A client customer picker searches `/api/customers` so customers beyond the first page remain selectable. Creation omits `sales_user_id` so FastAPI assigns the current user; editing preserves the existing assignee because the backend has no tenant user-list endpoint and this phase must not expand user management.

1. Extend backend project tests for pagination, default assignment, owner/sales transfer permissions, and cross-tenant customer/user/project isolation. Do not add backend behavior unless a tested gap is found.
2. Add failing browser tests and mock routes for project list, pagination, customer search beyond page one, create-from-customer, create validation/errors, detail placeholders, edit, 404/401, and JWT absence.
3. Add Project types, API client, BFF routes, customer picker, form, list/new/detail/edit pages, and enable the customer-detail project link. Commit in small BFF/UI/test steps.
4. Run all frontend and backend checks, perform the requested real FastAPI/PostgreSQL flow, document local and CI evidence separately, push, and wait for both GitHub Actions workflows on the latest SHA. Stop before Phase 2-6.
