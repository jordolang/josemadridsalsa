-- CreateEnum
CREATE TYPE "CustomerAccountType" AS ENUM ('STANDARD', 'FUNDRAISING', 'WHOLESALE');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "accountType" "CustomerAccountType" NOT NULL DEFAULT 'STANDARD';

-- CreateIndex
CREATE INDEX "customers_accountType_idx" ON "customers"("accountType");
