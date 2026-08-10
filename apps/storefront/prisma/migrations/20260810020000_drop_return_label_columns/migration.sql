-- Drop the prepaid-return-label columns.
--
-- Added one migration earlier for a feature that bought return postage on the business's carrier
-- account. That is not how returns work here: **the customer arranges and pays their own return
-- postage**, so there is no label to buy, no cost to front, and nothing to reconcile. The feature
-- and its route are gone, and columns nothing reads are a plan rather than a feature.
--
-- Safe to drop unconditionally: they were nullable, added hours ago, and never written to by any
-- code path that shipped.

DROP INDEX IF EXISTS "return_requests_returnLabelShipmentId_key";

ALTER TABLE "return_requests"
  DROP COLUMN IF EXISTS "returnLabelShipmentId",
  DROP COLUMN IF EXISTS "returnLabelTrackingCode",
  DROP COLUMN IF EXISTS "returnLabelUrl",
  DROP COLUMN IF EXISTS "returnLabelCarrier",
  DROP COLUMN IF EXISTS "returnLabelService",
  DROP COLUMN IF EXISTS "returnLabelCostCents",
  DROP COLUMN IF EXISTS "returnLabelPurchasedAt";
