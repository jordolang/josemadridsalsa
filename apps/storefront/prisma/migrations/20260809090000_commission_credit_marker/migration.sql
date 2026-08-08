-- Marks the moment a fundraiser order's commission was credited.
--
-- Six paths can mark an order paid: three completion routes and the three payment webhooks,
-- each pair racing the other. Crediting used to live inline in the completion routes only,
-- so a webhook that won the race meant the group was never paid for that sale at all. The
-- credit is now a single idempotent operation that claims this column before touching any
-- rollup, so exactly one path can credit a given order.
ALTER TABLE "orders" ADD COLUMN "commissionCreditedAt" TIMESTAMP(3);
