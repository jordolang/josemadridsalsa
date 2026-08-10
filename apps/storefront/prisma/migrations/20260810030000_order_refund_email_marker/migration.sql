-- Shared sent-marker for the "your refund went through" email.
--
-- Backfilled for orders already at REFUNDED so switching the new consumer on does not email
-- every customer the shop has ever refunded. Same reasoning as the campaign summary window:
-- a customer hearing about a refund from months ago reads as a second refund, not as service.

ALTER TABLE "orders" ADD COLUMN "refundEmailSentAt" TIMESTAMP(3);

UPDATE "orders"
SET "refundEmailSentAt" = "updatedAt"
WHERE "status" = 'REFUNDED' OR "paymentStatus" IN ('REFUNDED', 'PARTIALLY_REFUNDED');
