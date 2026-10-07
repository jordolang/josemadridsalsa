-- CreateEnum
CREATE TYPE "MerchOrderStatus" AS ENUM ('AWAITING_PAYMENT', 'SUBMITTING', 'SUBMITTED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "merch_orders" (
    "id" TEXT NOT NULL,
    "squareOrderId" TEXT NOT NULL,
    "squarePaymentLinkId" TEXT,
    "status" "MerchOrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "printifyOrderId" TEXT,
    "items" JSONB NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "lastError" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merch_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merch_orders_squareOrderId_key" ON "merch_orders"("squareOrderId");

-- CreateIndex
CREATE INDEX "merch_orders_status_createdAt_idx" ON "merch_orders"("status", "createdAt");
