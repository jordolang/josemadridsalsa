-- Track the highest sales milestone each fundraiser participant has been congratulated for.
--
-- Existing participants are backfilled to the highest milestone their current `totalOrders`
-- already passes, so switching the automation on does not congratulate a campaign's entire
-- roster for thresholds they crossed weeks ago.

ALTER TABLE "fundraiser_participants"
  ADD COLUMN "lastMilestoneNotified" INTEGER NOT NULL DEFAULT 0;

UPDATE "fundraiser_participants"
SET "lastMilestoneNotified" = CASE
  WHEN "totalOrders" >= 100 THEN 100
  WHEN "totalOrders" >= 50  THEN 50
  WHEN "totalOrders" >= 25  THEN 25
  WHEN "totalOrders" >= 10  THEN 10
  WHEN "totalOrders" >= 5   THEN 5
  ELSE 0
END;
