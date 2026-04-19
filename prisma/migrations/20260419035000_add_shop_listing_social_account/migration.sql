ALTER TABLE "shop_listings"
ADD COLUMN "socialAccountId" TEXT;

CREATE INDEX "shop_listings_socialAccountId_idx"
ON "shop_listings"("socialAccountId");

ALTER TABLE "shop_listings"
ADD CONSTRAINT "shop_listings_socialAccountId_fkey"
FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
