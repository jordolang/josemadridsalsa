-- CreateEnum
CREATE TYPE "OrderCustomerUpdateKind" AS ENUM ('NOTE', 'DELAY');

-- CreateTable
CREATE TABLE "order_customer_updates" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "OrderCustomerUpdateKind" NOT NULL DEFAULT 'NOTE',
    "message" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_customer_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sms_subscriptions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_sms_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_customer_updates_orderId_createdAt_idx" ON "order_customer_updates"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_sms_subscriptions_phone_idx" ON "order_sms_subscriptions"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "order_sms_subscriptions_orderId_phone_key" ON "order_sms_subscriptions"("orderId", "phone");

-- AddForeignKey
ALTER TABLE "order_customer_updates" ADD CONSTRAINT "order_customer_updates_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sms_subscriptions" ADD CONSTRAINT "order_sms_subscriptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
