-- Fundraiser commission taken back when an order is refunded.
--
-- Crediting a group for a sale that was returned leaves money owed against revenue that never
-- existed. The amount is recorded per refund rather than only decremented from the order, so
-- the original credit stays reconstructable and so the column can double as the claim that
-- stops one refund reversing twice.
--
-- Null means not a fundraiser refund, or not yet processed. It never means zero.
ALTER TABLE "refunds" ADD COLUMN "commissionReversed" DECIMAL(10,2);
