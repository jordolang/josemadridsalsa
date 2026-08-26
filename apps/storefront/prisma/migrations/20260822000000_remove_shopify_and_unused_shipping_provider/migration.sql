-- Remove the legacy Shopify order-sync integration.
--
-- The Shopify store this synced to has been shut down (its Admin API returns
-- 402 "Unavailable Shop"), and the platform is no longer migrating to or from it.
-- No order has ever synced successfully, so these columns hold nothing but the
-- failure strings written by the dead integration.
DROP INDEX "orders_shopifyOrderId_key";

ALTER TABLE "orders" DROP COLUMN "shopifyFinancialStatus",
DROP COLUMN "shopifyFulfillmentStatus",
DROP COLUMN "shopifyOrderId",
DROP COLUMN "shopifyOrderName",
DROP COLUMN "shopifySyncError",
DROP COLUMN "shopifySyncedAt";

-- Remove the unused ShippingProvider abstraction. Shipping runs through EasyPost,
-- configured by environment variables in lib/shipping-*; nothing ever read this
-- table and it is empty. ShippingCarrier is deliberately kept — the admin
-- shipping-label endpoint still resolves carriers through it.
DROP TABLE "shipping_providers";

DROP TYPE "ShippingProviderType";
