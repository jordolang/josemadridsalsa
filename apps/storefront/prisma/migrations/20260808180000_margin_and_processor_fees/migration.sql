-- Inputs for operational margin reporting.
--
-- Two columns, both deliberately nullable, and in both cases NULL means "not known" rather
-- than zero. Reporting that reads either as zero would overstate profit, which is the one
-- failure mode worth designing against here.

-- What a unit cost us at the moment it sold, snapshotted from Product.costPrice.
--
-- Margin cannot be computed from the product's *current* cost: doing so silently
-- recalculates every historical order every time a supplier changes their price. This is
-- the same reason OrderItem already snapshots productName and productSku — a completed sale
-- is a historical fact, not a live join.
--
-- Not backfilled. Every product currently has a NULL costPrice, so there is nothing to
-- backfill from, and inventing a cost would be worse than admitting we do not know one.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(10,2);

-- What the processor charged to take a payment, in cents to match payments.amount.
--
-- Filled by a reconciliation sweep rather than at webhook time. Square frequently does not
-- know its own fee when payment.completed fires — it computes it after settlement — so
-- webhook-time capture cannot work there at all. Given a sweep is required for Square
-- regardless, all three providers go through it: no extra API call inside a handler that
-- must not fail, and no new failure mode on the checkout path.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processorFee" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processorFeeCheckedAt" TIMESTAMP(3);

-- The sweep's working set: paid payments whose fee is still unknown.
CREATE INDEX IF NOT EXISTS "payments_processorFeeCheckedAt_idx"
  ON "payments"("processorFeeCheckedAt");
