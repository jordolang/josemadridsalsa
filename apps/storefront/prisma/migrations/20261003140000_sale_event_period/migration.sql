-- AlterTable
ALTER TABLE "fundraiser_sale_events" ADD COLUMN "period" TEXT;

-- Backfill: rows written before this column existed struck the battle of the month they were
-- recorded in (createdAt is stored in UTC, matching how battle periods are dated).
UPDATE "fundraiser_sale_events" SET "period" = to_char("createdAt", 'YYYY-MM') WHERE "period" IS NULL;

-- CreateIndex
CREATE INDEX "fundraiser_sale_events_period_teamId_idx" ON "fundraiser_sale_events"("period", "teamId");
