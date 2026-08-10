-- CreateEnum
CREATE TYPE "MileageCategory" AS ENUM ('SHOW', 'FARMERS_MARKET', 'FUNDRAISER', 'VENDOR', 'ERRAND', 'MISC');

-- CreateTable
CREATE TABLE "mileage_entries" (
    "id" TEXT NOT NULL,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "destination" TEXT NOT NULL,
    "city" TEXT,
    "state" VARCHAR(4),
    "miles" INTEGER,
    "oneWayMiles" INTEGER,
    "odometerStart" INTEGER,
    "odometerEnd" INTEGER,
    "driver" TEXT,
    "sales" DECIMAL(10,2),
    "category" "MileageCategory",
    "year" INTEGER NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceMd5" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "rawRow" JSONB,
    "contentHash" TEXT NOT NULL,
    "importSource" TEXT NOT NULL DEFAULT 'document-archive',
    "importBatchId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mileage_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mileage_entries_contentHash_key" ON "mileage_entries"("contentHash");

-- CreateIndex
CREATE INDEX "mileage_entries_year_idx" ON "mileage_entries"("year");

-- CreateIndex
CREATE INDEX "mileage_entries_driver_idx" ON "mileage_entries"("driver");

-- CreateIndex
CREATE INDEX "mileage_entries_sourceMd5_idx" ON "mileage_entries"("sourceMd5");
