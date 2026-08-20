-- One coordinator can run two organizations, so email identifies a person, not a record.
-- `dedupeKey` is the identity; email becomes a lookup index.
DROP INDEX "fundraiser_contacts_email_key";

-- CreateIndex
CREATE INDEX "fundraiser_contacts_email_idx" ON "fundraiser_contacts"("email");
