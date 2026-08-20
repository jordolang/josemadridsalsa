-- First-touch marketing attribution on orders.
--
-- Seven nullable columns capturing where a purchase came from — the UTM tuple plus the referring
-- host and the landing page — set at order creation from a first-touch cookie. All are additive
-- and nullable: existing orders, direct visits, and offline orders (POS/manual/phone/event) simply
-- carry none, so this is safe to apply to a populated table. See lib/analytics/attribution.ts.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "utmSource" TEXT,
  ADD COLUMN IF NOT EXISTS "utmMedium" TEXT,
  ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT,
  ADD COLUMN IF NOT EXISTS "utmTerm" TEXT,
  ADD COLUMN IF NOT EXISTS "utmContent" TEXT,
  ADD COLUMN IF NOT EXISTS "referrer" TEXT,
  ADD COLUMN IF NOT EXISTS "landingPage" TEXT;

-- Indexed on the two dimensions the attribution report groups by most.
CREATE INDEX IF NOT EXISTS "orders_utmSource_idx" ON "orders"("utmSource");
CREATE INDEX IF NOT EXISTS "orders_utmCampaign_idx" ON "orders"("utmCampaign");
