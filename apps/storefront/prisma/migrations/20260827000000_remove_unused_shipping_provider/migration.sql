-- Remove the unused ShippingProvider abstraction. Shipping runs through EasyPost,
-- configured by environment variables in lib/shipping-*; nothing ever read this
-- table and it is empty. ShippingCarrier is deliberately kept — the admin
-- shipping-label endpoint still resolves carriers through it.
--
-- Guarded, and ordered after 20260826230000_remove_shopify_integration, which
-- rewrites "ShippingProviderType" to drop its SHOPIFY value: on a database that
-- has already run that migration both objects still exist, and on one that has
-- not they may never have been created by a migration at all.
DROP TABLE IF EXISTS "shipping_providers";

DROP TYPE IF EXISTS "ShippingProviderType";
