-- The unified bookkeeping ledger: one row per money movement, summable, editable, exportable.
-- See the LedgerEntry model in schema.prisma for the accounting rules (one source per dollar).

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('ORDER', 'REFUND', 'SHOW_ARCHIVE', 'FUNDRAISER', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM (
  'PRODUCT_SALES', 'SHIPPING_INCOME', 'SALES_TAX_COLLECTED', 'SHOW_SALES', 'OTHER_INCOME',
  'COGS', 'PROCESSOR_FEES', 'SHIPPING_COST', 'SHOW_EXPENSES', 'REFUNDS', 'DISCOUNTS',
  'BOOTH_FEE', 'TRAVEL', 'MEALS', 'SUPPLIES', 'PAYROLL', 'OTHER_EXPENSE'
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" "LedgerCategory" NOT NULL,
    "source" "LedgerSource" NOT NULL,
    "sourceId" TEXT,
    "dedupeKey" TEXT,
    "description" TEXT NOT NULL,
    "counterparty" TEXT,
    "channel" "SalesChannel",
    "paymentMethod" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "exportedAt" TIMESTAMP(3),
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_dedupeKey_key" ON "ledger_entries"("dedupeKey");

-- CreateIndex
CREATE INDEX "ledger_entries_date_idx" ON "ledger_entries"("date");

-- CreateIndex
CREATE INDEX "ledger_entries_direction_idx" ON "ledger_entries"("direction");

-- CreateIndex
CREATE INDEX "ledger_entries_category_idx" ON "ledger_entries"("category");

-- CreateIndex
CREATE INDEX "ledger_entries_source_sourceId_idx" ON "ledger_entries"("source", "sourceId");

-- CreateIndex
CREATE INDEX "ledger_entries_exportedAt_idx" ON "ledger_entries"("exportedAt");
