-- Record the codes applied at checkout on the order itself, so that payment completion
-- (which also runs in the Stripe webhook, without any request context) knows what to
-- redeem. Redemption is deferred to payment success, so an abandoned checkout cannot
-- burn a gift certificate balance or consume a discount code's usage allowance.
--
-- All three columns are additive and nullable/defaulted, so existing orders are unaffected.
ALTER TABLE "orders" ADD COLUMN "discountCode" TEXT;
ALTER TABLE "orders" ADD COLUMN "giftCertificateCode" TEXT;
ALTER TABLE "orders" ADD COLUMN "giftCertificateAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
