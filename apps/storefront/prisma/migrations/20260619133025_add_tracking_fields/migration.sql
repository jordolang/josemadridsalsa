-- AlterTable: orders — add EasyPost tracking fields
ALTER TABLE "orders" ADD COLUMN     "carrierName" TEXT,
ADD COLUMN     "easypostShipmentId" TEXT,
ADD COLUMN     "lastTrackingUpdate" TIMESTAMP(3),
ADD COLUMN     "trackingHistory" JSONB,
ADD COLUMN     "trackingUrl" TEXT;

-- AlterTable: shipping_labels — the table already exists from the baseline
-- migration, so add the EasyPost shipment columns and relax the legacy
-- carrier-based columns (they are no longer required when EasyPost creates
-- the label) instead of recreating the table.
ALTER TABLE "shipping_labels" ALTER COLUMN "carrierId" DROP NOT NULL,
ALTER COLUMN "trackingNumber" DROP NOT NULL,
ADD COLUMN     "easypostShipmentId" TEXT,
ADD COLUMN     "trackingCode" TEXT,
ADD COLUMN     "carrierName" TEXT,
ADD COLUMN     "serviceName" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_labels_easypostShipmentId_key" ON "shipping_labels"("easypostShipmentId");

-- CreateIndex
CREATE INDEX "shipping_labels_trackingCode_idx" ON "shipping_labels"("trackingCode");
