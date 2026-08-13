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

-- Invariants the code relies on, enforced at the database so a stray write cannot break them:
--  * amounts are always positive (the sign lives in `direction`), so totals cannot be skewed;
--  * a manual row is exactly a MANUAL-source hand entry, and any derived row carries the
--    `dedupeKey` + `sourceId` that make its upsert idempotent — no derived row can slip in without
--    the key that stops it being written twice.
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_source_shape" CHECK (
  -- Mutually exclusive shapes: a manual row is a MANUAL-source hand entry with no dedupe key;
  -- a derived row is any other source and must carry both the dedupeKey and sourceId that make
  -- its upsert idempotent. Nothing in between is allowed.
  ("isManual" = true AND "source" = 'MANUAL' AND "dedupeKey" IS NULL AND "sourceId" IS NULL) OR
  ("isManual" = false AND "source" <> 'MANUAL' AND "dedupeKey" IS NOT NULL AND "sourceId" IS NOT NULL)
);
