-- Marks the moment an order's purchase loyalty points were awarded.
--
-- The loyalty program could redeem points but never earned any: the award helpers had no
-- callers, so the whole tier/rewards system was dead weight. Purchase points are now credited
-- from the same paid-marking transaction that credits fundraiser commission, across all four
-- providers (Stripe, PayPal, Square, POS). Like the commission credit, the award claims this
-- column before touching the loyalty account, so a webhook racing a completion route awards
-- the points exactly once.
ALTER TABLE "orders" ADD COLUMN "loyaltyPointsAwardedAt" TIMESTAMP(3);
