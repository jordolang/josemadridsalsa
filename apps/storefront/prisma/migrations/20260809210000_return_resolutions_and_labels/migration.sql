-- Return resolutions and prepaid return labels.
--
-- Three additions, all nullable, so no backfill is needed: an existing return has produced no
-- store credit, no exchange, and has no label, and null says exactly that.
--
-- Hand-written rather than taken verbatim from `migrate diff`, because the diff against the dev
-- database also picked up pre-existing drift unrelated to this change — a `shipping_labels`
-- carrier foreign-key onDelete difference and an extra `payments_processorFeeCheckedAt_idx`
-- index that the schema does not declare. Applying those here would have silently dropped an
-- index the processor-fee sweep filters on, in a migration about returns.

-- Store credit issued for a return, instead of a refund.
ALTER TABLE "return_requests" ADD COLUMN     "giftCertificateId" TEXT;

-- Prepaid label sent to the customer. Deliberately not a `shipping_labels` row: the EasyPost
-- tracking webhook resolves a label to its order and advances that order to delivered, which
-- would mark the customer's original order delivered when their return reached the warehouse.
ALTER TABLE "return_requests" ADD COLUMN     "returnLabelShipmentId" TEXT,
ADD COLUMN     "returnLabelTrackingCode" TEXT,
ADD COLUMN     "returnLabelUrl" TEXT,
ADD COLUMN     "returnLabelCarrier" TEXT,
ADD COLUMN     "returnLabelService" TEXT,
ADD COLUMN     "returnLabelCostCents" INTEGER,
ADD COLUMN     "returnLabelPurchasedAt" TIMESTAMP(3);

-- Non-null marks an order as a replacement raised by an exchange rather than a sale. Every
-- revenue report filters on this being null; without it an exchange reads as revenue 0 against
-- a real cost and reports a loss.
ALTER TABLE "orders" ADD COLUMN     "exchangeForReturnId" TEXT;

-- Unique, so one return can produce at most one of each outcome. The rule that it produces at
-- most one outcome *in total* is enforced in `lib/orders/return-resolution.ts`, which a unique
-- constraint cannot express.
CREATE UNIQUE INDEX "return_requests_giftCertificateId_key" ON "return_requests"("giftCertificateId");
CREATE UNIQUE INDEX "return_requests_returnLabelShipmentId_key" ON "return_requests"("returnLabelShipmentId");
CREATE UNIQUE INDEX "orders_exchangeForReturnId_key" ON "orders"("exchangeForReturnId");

ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_giftCertificateId_fkey" FOREIGN KEY ("giftCertificateId") REFERENCES "gift_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_exchangeForReturnId_fkey" FOREIGN KEY ("exchangeForReturnId") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
