-- AddColumn: emailStage to abandoned_carts
-- Tracks which stage of the 3-email abandoned-cart sequence has been sent
-- 0 = no email sent, 1 = 1h email sent, 2 = 24h email sent, 3 = 48h email sent (complete)
ALTER TABLE "abandoned_carts" ADD COLUMN "emailStage" INTEGER NOT NULL DEFAULT 0;

-- Replace old index with new compound index including emailStage for efficient cron queries
DROP INDEX IF EXISTS "abandoned_carts_emailSent_createdAt_idx";
CREATE INDEX "abandoned_carts_emailSent_emailStage_createdAt_idx" ON "abandoned_carts"("emailSent", "emailStage", "createdAt");
