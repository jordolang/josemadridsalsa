# Next Actions: Social Media, Merchandise, and Forms

_Updated: January 6, 2025_

This document outlines the follow-up engineering work required after the latest UI enhancements. Each section lists immediate actions, suggested tooling, and dependencies to address before shipping automation.

---

## 1. Social Media Autoposting

**Objectives**
- Deliver one-click publishing from `/admin/social` to Facebook, Instagram, X, Google Business, and TikTok.
- Ensure scheduled posts are reliably queued and retried with clear audit trails.

**Action Items**
1. **OAuth + Token Storage**
   - Implement platform-specific OAuth flows (Meta, X, Google Business, TikTok).
   - Store refresh + access tokens encrypted via `ServiceKey` (reuse AES-256-GCM).
   - Track token expiry and set up background refresh jobs.
2. **Posting Worker**
   - Create a queue table (`SocialMediaJob`) with status, retry count, and response payloads.
   - Add a background worker (Next.js Route Handler + cron or external job runner) that:
     - Translates post content into platform-specific payloads (media attachments, character limits).
     - Handles per-platform throttling and error mapping.
3. **Media Handling**
   - Allow attachment selection from the media library.
   - Generate pre-signed URLs or upload assets to each platform before posting.
4. **Scheduling & Approvals**
   - Enforce approve/publish workflow (optional dual-control) before queueing.
   - Send Slack/Email notifications on failure (integrate with existing messaging hooks).
5. **Testing**
   - Add Vitest coverage for serialization helpers.
   - Integration smoke tests with mocked platform APIs.

**Dependencies**
- Meta Marketing API, X API v2, Google Business Profile API, TikTok Business API credentials.
- Background job runner (Vercel Cron, PlanetScale scheduled functions, or external worker).

---

## 2. Merchandise Backend Integration

**Objectives**
- Replace static merch catalog data with live inventory and fulfillment status from the print partner.
- Support product CRUD, pricing updates, and order sync with the fulfillment provider.

**Action Items**
1. **Data Model & Sync**
   - Add Prisma models for `MerchProduct`, `MerchVariant`, `MerchOrder`, `MerchVendorCredential`.
   - Build sync jobs to pull inventory, pricing, and assets from the fulfillment API/SFTP feed.
   - Map variants to storefront products for direct purchase.
2. **Admin Workflows**
   - Enable bulk publishing/unpublishing, pricing edits, and margin simulations directly from `/admin/merchandise`.
   - Surface live fulfillment statuses (production, shipped, delayed) and tracking links.
3. **Ordering Pipeline**
   - Support D2C and fundraiser/B2B ordering flows:
     - Push confirmed orders to the fulfillment partner (API, SFTP, or email).
     - Reconcile shipment events back into the Jose Madrid order system.
4. **Asset Management**
   - Store mockups/print files in the media library with variant associations.
   - Provide approval workflow before products go live.
5. **Automation & Alerts**
   - Notify staff when stock falls below thresholds or when jobs stall.
   - Log sync events to `AuditLog` for traceability.

**Dependencies**
- Fulfillment partner API specs (REST/SOAP/SFTP).
- Inventory sync cadence (recommended: hourly) and rate limits.
- Media storage for large print files.

---

## 3. Form Storage & Publishing

**Objectives**
- Persist custom forms created in the admin builder. ✅ (Initial Prisma schema + UI save flows shipped Jan 6, 2025; run `npx prisma migrate dev --name add_form_templates` after pulling.)
- Support version history, approvals, and multi-format exports (HTML, PDF).

**Action Items**
1. **Database Layer**
   - ✅ `FormTemplate` + `FormTemplateVersion` models now live (JSON structure, slug, status, version).
   - ✅ Owner metadata now persists (see `npm run templates:backfill-owners` script) and template versions capture optional changelog notes for audit history.
2. **Persistence API**
   - ✅ Server actions power create/update with Zod validation and slug management.
   - ✅ REST endpoints under `/api/forms` (API-key scoped) now provide list/read/update/version management for third parties.
3. **Publishing Workflow**
   - Add approval step before forms become publicly accessible.
   - Generate signed URLs or static HTML files for published templates.
4. **PDF Rendering**
   - Evaluate Playwright, Puppeteer, or third-party service for HTML→PDF conversion.
   - Queue PDF generation to avoid blocking requests; store outputs in object storage.
5. **Analytics & Usage**
   - Track download counts and popular templates.
   - Capture feedback loop (e.g., “request a change” form for staff).

**Dependencies**
- Storage bucket for generated PDFs (S3, R2, etc.).
- Background job capability for heavy rendering tasks.
- Permission updates for new `forms:publish` capability.

---

## 4. Cross-Team Coordination

- **Finance Ops**: Define chart-of-accounts mapping for QuickBooks/Xero sync and confirm payroll provider.
- **Marketing**: Provide content calendars, platform-specific guidelines, and asset naming conventions.
- **Fulfillment Partner**: Finalize API credentials, rate limits, and support SLAs for merch integration.
- **Compliance**: Confirm retention policies for chat transcripts and stored forms (PII considerations).

---

## 5. Tracking & Follow-Up

- Add Jira/Epic references once tickets are created for each work stream.
- Update `docs/PROJECT_STATUS.md` after backend integrations begin.
- Schedule end-to-end QA once autoposting and merch sync hit staging environments.
