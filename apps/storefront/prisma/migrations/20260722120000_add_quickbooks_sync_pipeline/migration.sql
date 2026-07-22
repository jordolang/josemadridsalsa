-- CreateEnum
CREATE TYPE "QuickBooksEntityType" AS ENUM ('CUSTOMER', 'ITEM', 'SALES_RECEIPT', 'REFUND_RECEIPT');

-- CreateEnum
CREATE TYPE "QuickBooksSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED', 'BLOCKED', 'SKIPPED');

-- CreateTable
CREATE TABLE "quickbooks_sync_records" (
    "id" TEXT NOT NULL,
    "entityType" "QuickBooksEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "QuickBooksSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "quickbooksId" TEXT,
    "payload" JSONB,
    "nextAttemptAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quickbooks_entity_maps" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "entityType" "QuickBooksEntityType" NOT NULL,
    "localId" TEXT NOT NULL,
    "quickbooksId" TEXT NOT NULL,
    "syncToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_entity_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quickbooks_settings" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "incomeAccountId" TEXT,
    "depositAccountId" TEXT,
    "shippingItemId" TEXT,
    "discountAccountId" TEXT,
    "giftCertificateAccountId" TEXT,
    "syncStartDate" TIMESTAMP(3),
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quickbooks_sync_records_entityType_entityId_key" ON "quickbooks_sync_records"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "quickbooks_sync_records_status_nextAttemptAt_idx" ON "quickbooks_sync_records"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "quickbooks_entity_maps_realmId_entityType_localId_key" ON "quickbooks_entity_maps"("realmId", "entityType", "localId");

-- CreateIndex
CREATE INDEX "quickbooks_entity_maps_realmId_entityType_quickbooksId_idx" ON "quickbooks_entity_maps"("realmId", "entityType", "quickbooksId");

-- CreateIndex
CREATE UNIQUE INDEX "quickbooks_settings_realmId_key" ON "quickbooks_settings"("realmId");
