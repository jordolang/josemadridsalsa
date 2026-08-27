-- Remove the legacy Shopify order-sync integration.
--
-- The Shopify store this synced to has been shut down and the platform is no
-- longer migrating to or from it. No order ever synced successfully, so these
-- columns hold nothing but the failure strings written by the dead integration.
DROP INDEX IF EXISTS "orders_shopifyOrderId_key";

ALTER TABLE "orders"
  DROP COLUMN IF EXISTS "shopifyFinancialStatus",
  DROP COLUMN IF EXISTS "shopifyFulfillmentStatus",
  DROP COLUMN IF EXISTS "shopifyOrderId",
  DROP COLUMN IF EXISTS "shopifyOrderName",
  DROP COLUMN IF EXISTS "shopifySyncError",
  DROP COLUMN IF EXISTS "shopifySyncedAt";

-- Drop SHOPIFY from ShippingProviderType. Postgres cannot remove a single enum
-- value, so the type is recreated without it. Nothing ever wrote a SHOPIFY
-- provider, but the DELETE keeps the type swap from failing if one exists —
-- these migrations run during the Vercel build behind a `|| echo` guard, where
-- a failure would only WARN rather than stop the deploy.
DELETE FROM "shipping_providers" WHERE "type" = 'SHOPIFY';

ALTER TYPE "ShippingProviderType" RENAME TO "ShippingProviderType_old";

CREATE TYPE "ShippingProviderType" AS ENUM ('SHIPSTATION', 'SHIPPO', 'USPS', 'CUSTOM');

ALTER TABLE "shipping_providers"
  ALTER COLUMN "type" TYPE "ShippingProviderType"
  USING ("type"::text::"ShippingProviderType");

DROP TYPE "ShippingProviderType_old";
