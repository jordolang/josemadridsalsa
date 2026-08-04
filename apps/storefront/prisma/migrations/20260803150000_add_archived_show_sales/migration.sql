-- CreateEnum
CREATE TYPE "ArchivedShowType" AS ENUM ('SHOW', 'FARMERS_MARKET');

-- CreateTable
CREATE TABLE "archived_show_sales" (
    "id" TEXT NOT NULL,
    "showName" TEXT NOT NULL,
    "showDate" TIMESTAMP(3),
    "dateText" TEXT,
    "year" INTEGER,
    "eventType" "ArchivedShowType" NOT NULL DEFAULT 'SHOW',
    "sales" DECIMAL(10,2),
    "amountPaid" DECIMAL(10,2),
    "expenses" DECIMAL(10,2),
    "salesPerson" TEXT,
    "sourceFile" TEXT NOT NULL,
    "sourceMd5" TEXT,
    "sourceRow" INTEGER,
    "contentHash" TEXT NOT NULL,
    "importSource" TEXT NOT NULL DEFAULT 'document-archive',
    "importBatchId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_show_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archived_show_sales_contentHash_key" ON "archived_show_sales"("contentHash");

-- CreateIndex
CREATE INDEX "archived_show_sales_year_idx" ON "archived_show_sales"("year");

-- CreateIndex
CREATE INDEX "archived_show_sales_eventType_idx" ON "archived_show_sales"("eventType");
