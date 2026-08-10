-- Close the retroactive-summary hole left by 20260810010000.
--
-- That migration backfilled `summaryEmailSentAt` for campaigns already at status ENDED. It
-- missed campaigns still marked ACTIVE whose `endDate` is in the past — of which there are
-- plenty, because nothing has ever closed a campaign automatically before now. On its first
-- run the lifecycle sweep ends those and then, finding no marker, emails a closing summary for
-- a fundraiser that finished months ago. That happened on the dev database and is exactly what
-- must not happen in production.
--
-- Stamping them here treats pre-existing expired campaigns as history rather than as news.
-- Campaigns that expire *after* this migration runs are unaffected and summarise normally.

UPDATE "fundraisers"
SET
  "summaryEmailSentAt" = COALESCE("summaryEmailSentAt", "updatedAt"),
  "launchEmailSentAt"  = COALESCE("launchEmailSentAt", "updatedAt")
WHERE "status" = 'ACTIVE'
  AND "endDate" < CURRENT_TIMESTAMP;
