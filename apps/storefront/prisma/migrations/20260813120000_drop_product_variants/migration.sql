-- Drop `product_variants`, a decorative model that was never wired to a sale.
--
-- The table had an admin editor and a customer-facing "Select Options" control, but the
-- selection reached nothing: no `order_items` or `cart_items` column recorded it, and the
-- add-to-cart button ignored it and used the base product price and SKU. A shopper could pick a
-- variant and it changed neither the price charged, the SKU shipped, nor the stock deducted. It
-- was UI attached to no behaviour. The distinct pricing/handling the business actually needs
-- lives in `sales_channel` (retail, fundraiser, wholesale, event) instead.
--
-- The guard is the point, mirroring `20260810040000_drop_email_webhooks`: the developer database
-- this was checked against is not production, so the migration refuses to run if any rows exist
-- rather than trust that production is also empty. `vercel-build` wraps `prisma migrate deploy`
-- in a warning rather than a failure, so the failure mode is "the table survives and someone
-- reads the log", which is the right way round for a destructive change that cannot be undone.

DO $$
DECLARE
  row_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO row_count FROM "product_variants";

  IF row_count > 0 THEN
    RAISE EXCEPTION
      'product_variants holds % row(s); refusing to drop. Export them first, then re-run.',
      row_count;
  END IF;
END $$;

DROP TABLE "product_variants";
