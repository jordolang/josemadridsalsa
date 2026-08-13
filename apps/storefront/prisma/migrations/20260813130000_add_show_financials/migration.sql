-- Add the financial fields a show needs to compute its own break-even.
--
-- `boothFee`, `costOfFuel`, `lodging` and `meals` already existed on the event (written until now
-- only by the Show CSV import and shown nowhere). These four columns complete the picture: a
-- free-form `otherExpenses` (+ note) for costs the fixed lines miss, and the money taken split
-- into `cashSales` and `cardSales` so the till can be reconciled. All are nullable — a show that
-- has not returned yet has entered none of them, and a blank must read as "not entered", never $0.

ALTER TABLE "featured_events"
  ADD COLUMN "otherExpenses" DECIMAL(10,2),
  ADD COLUMN "otherExpensesNote" TEXT,
  ADD COLUMN "cashSales" DECIMAL(10,2),
  ADD COLUMN "cardSales" DECIMAL(10,2);
