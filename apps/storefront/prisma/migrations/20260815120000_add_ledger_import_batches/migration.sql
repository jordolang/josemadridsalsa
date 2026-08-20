-- Stage 3 of the bookkeeping ledger: reading bank and card statements into it.
--
-- Purely additive — one new table. Ledger rows created by an import reuse the existing
-- `LedgerSource.IMPORT` value and point `sourceId` at a batch here, so `ledger_entries` is
-- unchanged.

CREATE TABLE IF NOT EXISTS "ledger_import_batches" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "rowsParsed" INTEGER NOT NULL DEFAULT 0,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ledger_import_batches_createdAt_idx" ON "ledger_import_batches"("createdAt");
