-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "carrierName" TEXT,
ADD COLUMN     "easypostShipmentId" TEXT,
ADD COLUMN     "lastTrackingUpdate" TIMESTAMP(3),
ADD COLUMN     "trackingHistory" JSONB,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "shipping_labels" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "easypostShipmentId" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "labelUrl" TEXT,
    "carrierName" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_labels_easypostShipmentId_key" ON "shipping_labels"("easypostShipmentId");

-- CreateIndex
CREATE INDEX "shipping_labels_orderId_idx" ON "shipping_labels"("orderId");

-- CreateIndex
CREATE INDEX "shipping_labels_trackingCode_idx" ON "shipping_labels"("trackingCode");

-- AddForeignKey
ALTER TABLE "shipping_labels" ADD CONSTRAINT "shipping_labels_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
