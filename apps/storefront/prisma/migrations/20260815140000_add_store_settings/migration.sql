-- Store-wide settings: one global row keyed by `singleton`, mirroring shipping_settings. New table,
-- so this is purely additive; the single row is created lazily on first save (upsert).

-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'singleton',
    "allowGuestCheckout" BOOLEAN NOT NULL DEFAULT true,
    "minimumOrderCents" INTEGER NOT NULL DEFAULT 0,
    "businessName" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "businessAddress" TEXT,
    "defaultLowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "termsContent" TEXT,
    "privacyContent" TEXT,
    "returnsContent" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_singleton_key" ON "store_settings"("singleton");
