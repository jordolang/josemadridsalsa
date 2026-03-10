-- CreateTable
CREATE TABLE "shipping_settings" (
    "id" TEXT NOT NULL,
    "freeShippingThreshold" DECIMAL(10,2),
    "originAddress" JSONB,
    "defaultCarrier" TEXT,
    "enabledCarriers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shipping_settings" ADD CONSTRAINT "shipping_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
