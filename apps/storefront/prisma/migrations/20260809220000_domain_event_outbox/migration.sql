-- Turn `domain_events` into a transactional outbox.
--
-- Existing rows are backfilled to consumed so the first poll does not replay the entire
-- history of every order ever placed as if it had just happened.

ALTER TABLE "domain_events" ADD COLUMN "consumedAt" TIMESTAMP(3);

UPDATE "domain_events" SET "consumedAt" = "createdAt" WHERE "consumedAt" IS NULL;

CREATE INDEX "domain_events_consumedAt_createdAt_idx"
  ON "domain_events"("consumedAt", "createdAt");
