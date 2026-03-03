-- CreateTable
-- Add RestockNotification table for tracking restock notifications
CREATE TABLE "restock_notifications" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stockLevel" INTEGER NOT NULL,
    "recommendedQty" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentTo" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restock_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restock_notifications_productId_idx" ON "restock_notifications"("productId");

-- CreateIndex
CREATE INDEX "restock_notifications_createdAt_idx" ON "restock_notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "restock_notifications" ADD CONSTRAINT "restock_notifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
