-- How a group runs its drive: collecting order forms for a bulk delivery, or online only.
--
-- Not a switch over the online store. Every campaign keeps a live link either way, because a
-- supporter who would rather not fill in a paper form still needs somewhere to buy. This only
-- records whether the group is also collecting forms.

CREATE TYPE "FulfillmentMethod" AS ENUM ('ORDER_FORMS_AND_BULK', 'ONLINE_ONLY');
CREATE TYPE "BrochureOption" AS ENUM ('PRINT_YOUR_OWN', 'PROFESSIONAL_100');

-- ── The agreed method, and its terms ─────────────────────────────────────────
-- Collecting order forms is the default: it is the classic salsa drive and what most groups
-- run. Existing campaigns adopt it too — they predate the distinction, and every one of them
-- was set up by hand for a group that collects.
ALTER TABLE "fundraisers"
  ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'ORDER_FORMS_AND_BULK',
  ADD COLUMN "brochureOption"    "BrochureOption",
  -- Snapshotted per campaign rather than read from a global setting, so a later change to the
  -- standard fee cannot re-price a drive that is already running.
  ADD COLUMN "brochureFee"       DECIMAL(10,2),
  ADD COLUMN "bulkDeliveryFee"   DECIMAL(10,2),
  -- The bulk delivery is a wholesale sale to a reseller, which is only tax-free with a
  -- certificate on file.
  ADD COLUMN "resaleNumber"      TEXT,
  ADD COLUMN "resaleVerifiedAt"  TIMESTAMP(3);

-- ── What the school asked for on the application ─────────────────────────────
-- Nullable and with no default: a request that was never made is not the same fact as a
-- request for the default, and the approval dialog needs to tell them apart.
ALTER TABLE "fundraiser_signup_requests"
  ADD COLUMN "requestedFulfillment" "FulfillmentMethod",
  ADD COLUMN "requestedBrochure"    "BrochureOption",
  ADD COLUMN "resaleNumber"         TEXT;
