-- Add `EVENT` to `SalesChannel`.
--
-- The business rings up four kinds of sale with different pricing and handling: regular retail
-- (the website, WEBSITE), fundraiser (its own flow, FUNDRAISER), wholesale (a negotiated manual
-- order, WHOLESALE), and event sales at festivals and markets. The first three already had a
-- channel; event sales had nowhere to go and were being folded into MANUAL or POS. This gives
-- them a name of their own so they can be filtered and reported like the rest.
--
-- `ADD VALUE IF NOT EXISTS` is idempotent, so a re-run against a database that already has the
-- value is a no-op rather than an error.

ALTER TYPE "SalesChannel" ADD VALUE IF NOT EXISTS 'EVENT';
