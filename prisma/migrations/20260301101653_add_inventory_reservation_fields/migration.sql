-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stockReserved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockStatus" "StockStatus" NOT NULL DEFAULT 'IN_STOCK';

-- Constraint: stockReserved must be non-negative
ALTER TABLE "products" ADD CONSTRAINT "products_stockReserved_non_negative" CHECK ("stockReserved" >= 0);

-- Backfill stockStatus based on existing inventory and lowStockThreshold values
UPDATE "products" SET "stockStatus" = CASE
  WHEN "inventory" <= 0 THEN 'OUT_OF_STOCK'::"StockStatus"
  WHEN "inventory" <= "lowStockThreshold" THEN 'LOW_STOCK'::"StockStatus"
  ELSE 'IN_STOCK'::"StockStatus"
END;
