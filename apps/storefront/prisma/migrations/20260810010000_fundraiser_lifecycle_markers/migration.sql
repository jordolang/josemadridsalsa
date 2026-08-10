-- Sent-markers for the two coordinator emails around a campaign's life.
--
-- Campaigns that are already running or already over are backfilled as "sent". Turning the
-- sweep on should not announce the launch of a fundraiser that started in March, nor mail a
-- closing summary for every campaign the shop has ever run.

ALTER TABLE "fundraisers"
  ADD COLUMN "launchEmailSentAt"  TIMESTAMP(3),
  ADD COLUMN "summaryEmailSentAt" TIMESTAMP(3);

UPDATE "fundraisers"
SET "launchEmailSentAt" = "updatedAt"
WHERE "status" IN ('ACTIVE', 'ENDED');

UPDATE "fundraisers"
SET "summaryEmailSentAt" = "updatedAt"
WHERE "status" = 'ENDED';
