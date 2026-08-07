-- Notification centre: categories beyond order events, a severity, a destination link, and
-- a dedupe key so a recurring condition updates one row rather than flooding the list.
-- Additive only; existing notifications default to INFO with no dedupe key.

CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVENTORY_LOW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVENTORY_OUT_OF_STOCK';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INTEGRATION_FAILED';

ALTER TABLE "notifications"
  ADD COLUMN "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN "link" TEXT,
  ADD COLUMN "dedupeKey" TEXT;

-- NULL dedupeKey never collides in Postgres, so ad-hoc notifications remain unconstrained
-- while keyed ones are unique per recipient.
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");
