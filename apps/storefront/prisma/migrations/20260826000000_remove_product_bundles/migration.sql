-- Remove product bundles.
--
-- The feature added by 20260822120000_add_product_bundles is being withdrawn. That migration
-- stays where it is: it has already been applied, and deleting an applied migration leaves a
-- row in `_prisma_migrations` with no matching directory, which `prisma migrate deploy` reports
-- as drift and refuses to run past. The way to undo an applied migration is another migration.
--
-- Every statement is guarded, because environments disagree about whether the up-migration ever
-- ran: the development database has no record of it and none of its tables, while any
-- environment that deployed from main after 478f40cc does. This has to be a no-op where the
-- tables were never created rather than an error that stops the rest of the deploy.

-- The foreign keys and indexes belong to these tables and go with them.
DROP TABLE IF EXISTS "bundle_products";
DROP TABLE IF EXISTS "bundles";

-- Bundle tags on order lines. Nullable and only ever written by the bundle checkout path, which
-- is gone, so no order history is lost with them.
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "bundleId";
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "bundleName";
