-- BigCommerce fundraising-store orders are mirrored into `orders` and credited to a fundraiser
-- found by its normalized checkout group name.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "sellerName" TEXT;

-- AlterTable
ALTER TABLE "fundraisers" ADD COLUMN "bigCommerceGroup" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "fundraisers_bigCommerceGroup_key" ON "fundraisers"("bigCommerceGroup");
