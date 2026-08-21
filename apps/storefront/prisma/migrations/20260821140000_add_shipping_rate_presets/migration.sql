-- Flat-rate shipping presets on the shipping_settings singleton. Purely additive nullable columns;
-- a null on any column means "use the built-in default", so quoted rates are unchanged until set.

ALTER TABLE "shipping_settings" ADD COLUMN IF NOT EXISTS "flatRateCents" INTEGER;
ALTER TABLE "shipping_settings" ADD COLUMN IF NOT EXISTS "weightSurchargeBaseCents" INTEGER;
ALTER TABLE "shipping_settings" ADD COLUMN IF NOT EXISTS "weightSurchargePerLbCents" INTEGER;
ALTER TABLE "shipping_settings" ADD COLUMN IF NOT EXISTS "weightSurchargeThresholdLb" INTEGER;
ALTER TABLE "shipping_settings" ADD COLUMN IF NOT EXISTS "internationalRateCents" INTEGER;
ALTER TABLE "shipping_settings" ADD COLUMN IF NOT EXISTS "stateSurcharges" JSONB;
