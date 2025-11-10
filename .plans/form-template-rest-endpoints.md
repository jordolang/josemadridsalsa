# Plan: Expose Form Template REST Endpoints

- **Source TODO**: `docs/NEXT_STEPS_AUTOMATION.md:85`
- **Goal**: Allow trusted third parties to manage form templates via REST (CRUD + publishing) instead of the internal admin UI.

## Context & Assumptions
- Current functionality exists only via Next.js server actions backed by Prisma; validation already lives in shared Zod schemas under `lib/`.
- Third parties authenticate via API keys scoped to partner accounts (or OAuth in the future). For now, we can reuse existing API key infrastructure if available; otherwise add a simple HMAC key table.
- Versioning is required: API consumers must be able to create new `FormTemplateVersion` records and retrieve published ones.

## Implementation Steps
1. **API design + contract**
   - Define endpoint matrix under `app/api/forms`:
     - `GET /api/forms` (list with pagination + filters like `status`, `category`).
     - `POST /api/forms` (create template draft).
     - `GET /api/forms/:slug` (fetch draft or published state).
     - `PATCH /api/forms/:slug` (update metadata, status transitions).
     - `POST /api/forms/:slug/versions` (append version with structure + changelog notes).
   - Document the request/response schema in `docs/forms-rest-api.md` including error codes and idempotency guidance.
2. **Authentication & authorization**
   - Add middleware (e.g., `app/api/forms/route.ts` helpers) that validates an `X-API-Key` header against a `PartnerApiKey` table (create if missing) and maps it to allowed actions.
   - Enforce RBAC: some partners may be read-only; reflect that in middleware before reaching handlers.
   - Log every request to `AuditLog` with partner ID and payload hash for traceability.
3. **Handler implementation**
   - Reuse existing server action logic by extracting business rules into shared lib functions (e.g., `lib/forms/service.ts`).
   - Validate payloads with Zod, coerce into Prisma inputs, and wrap writes in transactions where multiple tables are touched (`FormTemplate` + `FormTemplateVersion`).
   - For list/read endpoints, support ETag/`If-None-Match` for caching and include pagination metadata.
4. **Rate limiting & observability**
   - Apply per-key rate limiting using Upstash Redis or an in-memory fallback (e.g., `@upstash/ratelimit`). Default: 60 writes/min, 600 reads/min.
   - Emit metrics/logs (time, status code) via the existing logging utility for monitoring.
5. **Testing & examples**
   - Add Vitest coverage for service helpers and route handlers (using `next-test-api-route-handler` or the App Router testing helpers).
   - Create integration examples under `docs/examples/forms-api/` plus a `scripts/demo-forms-api.http` file for REST client testing.
   - Verify with `npx vitest run`, `npm run lint`, `npm run type-check` before publishing the docs.

## Risks & Dependencies
- Need a secure way to provision/rotate API keys before opening the endpoints.
- Rate limiting storage (Redis) must be available in all environments.
- Backwards compatibility: if JSON schema changes, version the endpoint via `/api/v1/forms`.

## Validation
- Unit tests for validation + Prisma service functions.
- Contract tests that hit the API routes with mocked auth to ensure status codes + response bodies match the spec.
- Manual verification via REST client (cURL or Thunder Client) for create/update/publish flows.
