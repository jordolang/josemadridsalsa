-- The table is populated by `fundraisers:build-contacts`, which is the only writer of this
-- column, so an empty-string default is safe here and the unique index takes effect before
-- the first import runs.
ALTER TABLE "fundraiser_contacts" ADD COLUMN "dedupeKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "fundraiser_contacts" ALTER COLUMN "dedupeKey" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_contacts_dedupeKey_key" ON "fundraiser_contacts"("dedupeKey");
