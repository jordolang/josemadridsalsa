-- CreateEnum
CREATE TYPE "ArchivedFundraiserFormType" AS ENUM ('ORDER_EXPORT', 'ORDER_FORM', 'UNKNOWN');

-- CreateTable
CREATE TABLE "archived_fundraisers" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "year" INTEGER,
    "orderDate" TIMESTAMP(3),
    "submittedBy" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "formType" "ArchivedFundraiserFormType" NOT NULL DEFAULT 'UNKNOWN',
    "totalJars" INTEGER,
    "orderCount" INTEGER,
    "flavorsJson" JSONB,
    "sourceFile" TEXT NOT NULL,
    "sourceMd5" TEXT,
    "notes" TEXT,
    "importSource" TEXT NOT NULL DEFAULT 'document-archive',
    "importBatchId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_fundraisers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archived_fundraisers_sourceFile_key" ON "archived_fundraisers"("sourceFile");

-- CreateIndex
CREATE INDEX "archived_fundraisers_year_idx" ON "archived_fundraisers"("year");

-- CreateIndex
CREATE INDEX "archived_fundraisers_organizationName_idx" ON "archived_fundraisers"("organizationName");
