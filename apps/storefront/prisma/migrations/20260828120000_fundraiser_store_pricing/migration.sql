-- Each fundraiser is its own store: its own price per jar, its own share of the
-- proceeds, and its own thank-you page after checkout.

-- The group's share defaults to half. Existing rows keep whatever rate they were set up with.
ALTER TABLE "fundraisers" ALTER COLUMN "commissionRate" SET DEFAULT 50.00;

-- What the fundraiser's store charges per jar when a product carries no override of its own.
ALTER TABLE "fundraisers" ADD COLUMN "defaultUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 10.00;

-- Thank-you page. All optional — blanks are filled from the organization's own name.
ALTER TABLE "fundraisers" ADD COLUMN "thankYouHeadline" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "thankYouMessage" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "thankYouImageUrl" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "thankYouCtaLabel" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "thankYouCtaUrl" TEXT;
