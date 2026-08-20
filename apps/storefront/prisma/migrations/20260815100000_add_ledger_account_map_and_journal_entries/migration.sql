-- Stage 2 of the bookkeeping ledger: exporting and syncing ledger rows to QuickBooks Online.
--
-- Two additions, both purely additive: nothing is dropped, nothing is rewritten, and every
-- existing row keeps working unchanged (`ledgerAccountMap` is null until the mapping screen is
-- used, and the new enum value is only written by the journal sync).

-- A ledger row posted as a double-entry JournalEntry, for money that never became an order.
ALTER TYPE "QuickBooksEntityType" ADD VALUE IF NOT EXISTS 'JOURNAL_ENTRY';

-- Category -> QuickBooks account mapping for the ledger export and the journal sync.
ALTER TABLE "quickbooks_settings" ADD COLUMN IF NOT EXISTS "ledgerAccountMap" JSONB;
