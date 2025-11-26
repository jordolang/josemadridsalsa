ALTER TABLE "orders"
  ADD COLUMN "shopifyOrderId" TEXT,
  ADD COLUMN "shopifyOrderName" TEXT,
  ADD COLUMN "shopifyFinancialStatus" TEXT,
  ADD COLUMN "shopifyFulfillmentStatus" TEXT,
  ADD COLUMN "shopifySyncedAt" TIMESTAMP(3),
  ADD COLUMN "shopifySyncError" TEXT;

CREATE UNIQUE INDEX "orders_shopifyOrderId_key"
  ON "orders"("shopifyOrderId")
  WHERE "shopifyOrderId" IS NOT NULL;
