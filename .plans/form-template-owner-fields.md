# Plan: Backfill Form Template Owner Metadata

- **Source TODO**: `docs/NEXT_STEPS_AUTOMATION.md:82`
- **Goal**: Populate `createdById`/`updatedById` on `FormTemplate` & `FormTemplateVersion`, wire them into the auth system, and add an optional changelog notes column for richer auditability.

## Context & Assumptions
- The Prisma models already expose nullable `createdById`/`updatedById` fields, but historical rows are null because authentication was not hooked up.
- The app uses NextAuth (or another provider) that yields a stable `User.id`; server actions already gate access, so we can thread the session there.
- A “system” user exists (or can be seeded) to own legacy templates when a real creator cannot be determined.

## Implementation Steps
1. **Confirm authentication plumbing**
   - Ensure server actions/pages that mutate `FormTemplate` records can access the signed-in `User`. If not, add a helper (e.g., `requireStaffSession()`) that returns `{ userId }` for downstream calls.
2. **Schema update for changelog notes**
   - Add `changelogNotes String? @map("changelog_notes")` to `FormTemplateVersion` in `prisma/schema.prisma` plus the corresponding SQL migration (`npm run db:migrate -- --name add_form_template_changelog_notes`).
   - Expose the field via Prisma client and extend Zod schemas/types so the UI can capture optional notes when publishing new versions.
3. **Data backfill script**
   - Create `scripts/backfill-form-template-owners.ts` that:
     1. Looks up the designated “system” user (fallback to env `SYSTEM_OWNER_EMAIL`).
     2. Iterates over `FormTemplate` rows where `createdById` is null and sets both `createdById` and `updatedById` to the appropriate owner.
     3. Iterates over `FormTemplateVersion` rows to set `createdById`.
     4. Logs counts and exits non-zero on failure.
   - Run the script locally against dev DB, then document the prod runbook in `docs/`.
4. **Wire ownership into create/update flows**
   - Update server actions (e.g., `app/(admin)/forms/actions.ts`) to set `createdById = session.user.id` on create and `updatedById = session.user.id` on updates.
   - When publishing a new version, allow staff to supply optional `changelogNotes`; persist to the new column and show it in the UI change history.
5. **Verification & rollout**
   - After migration/backfill, run `npm run db:generate` to refresh the Prisma client.
   - Provide a checklist for deploying: run migration, execute backfill script once, then redeploy the app so new writes honor the ownership guarantees.

## Risks & Dependencies
- Need clarity on which historic user (or “system”) should own legacy records.
- Backfill must run during a maintenance window because it touches every template/version row.
- UI/UX for changelog notes should be minimal to avoid blocking publication.

## Validation
- Add Vitest coverage for the backfill utility (mock Prisma client to ensure the right update batches).
- Add tests around the server action to confirm the `userId` is patched into Prisma inputs.
- Manually verify via the admin UI: create a template, edit it, publish a version with notes, and confirm the DB reflects owner IDs + stored notes.
