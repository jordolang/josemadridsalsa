-- Drop `product_variants`, a decorative model that was never wired to a sale.
--
-- The table had an admin editor and a customer-facing "Select Options" control, but the
-- selection reached nothing: no `order_items` or `cart_items` column recorded it, and the
-- add-to-cart button ignored it and used the base product price and SKU. A shopper could pick a
-- variant and it changed neither the price charged, the SKU shipped, nor the stock deducted. It
-- was UI attached to no behaviour. The distinct pricing/handling the business actually needs
-- lives in `sales_channel` (retail, fundraiser, wholesale, event) instead.
--
-- Two guards, in order:
--   1. Idempotent — if the table is already gone (a re-run, or an environment that never had it),
--      `to_regclass` returns NULL and the migration is a no-op rather than erroring on a COUNT
--      against a missing relation.
--   2. Safe — if the table exists and still holds rows, refuse. This is deliberate: the developer
--      database this was checked against is not production, so rather than trust that production is
--      also empty, a non-empty table stops the migration and is exported first. Dropping data is
--      not something to do on an assumption.

DO $$
DECLARE
  row_count BIGINT;
BEGIN
  IF to_regclass('"product_variants"') IS NULL THEN
    RAISE NOTICE 'product_variants already absent; nothing to drop.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO row_count FROM "product_variants";

  IF row_count > 0 THEN
    RAISE EXCEPTION
      'product_variants holds % row(s); refusing to drop. Export them first, then re-run.',
      row_count;
  END IF;

  DROP TABLE "product_variants";
END $$;
