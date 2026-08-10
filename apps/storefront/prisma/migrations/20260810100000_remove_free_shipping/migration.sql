-- Remove free shipping from the platform entirely.
--
-- The business does not offer free shipping and never has. What existed was a
-- `freeShippingThreshold` that zeroed the shipping line above a subtotal (defaulting to $50 in
-- code when null) and a `FREE_SHIPPING` discount type that did the same on demand.
--
-- Both were live and costly: with real carrier rates now reaching checkout, a six-jar order
-- crossed the $50 default and shipped at a cost of ~$11.88 to the business, and a twelve-jar
-- order at ~$35.74. Nothing charged the customer for it.
--
-- Safe to drop: zero `FREE_SHIPPING` discount codes exist in either database, and
-- `freeShippingThreshold` is null in both, so no configured behaviour is being removed.

ALTER TABLE "shipping_settings" DROP COLUMN IF EXISTS "freeShippingThreshold";

-- Postgres cannot drop a value from an enum in place, so the type is rebuilt. Guarded by the
-- verified absence of rows using the value; a row that somehow used it would fail the cast
-- loudly rather than being silently rewritten to something else.
ALTER TYPE "DiscountType" RENAME TO "DiscountType_old";

CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

ALTER TABLE "discount_codes"
  ALTER COLUMN "type" TYPE "DiscountType"
  USING ("type"::text::"DiscountType");

DROP TYPE "DiscountType_old";
