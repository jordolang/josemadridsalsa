CREATE TABLE "retail_locations" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "photoUrl" TEXT,
    "googlePlacesId" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "county" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "retail_locations_city_idx" ON "retail_locations"("city");

CREATE INDEX "retail_locations_state_idx" ON "retail_locations"("state");

CREATE INDEX "retail_locations_state_city_idx" ON "retail_locations"("state", "city");

CREATE INDEX "retail_locations_isActive_idx" ON "retail_locations"("isActive");

CREATE UNIQUE INDEX "retail_locations_businessName_address_key" ON "retail_locations"("businessName", "address");
