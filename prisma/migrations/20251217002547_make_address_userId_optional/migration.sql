-- AlterTable
-- Make userId optional in addresses table to support guest checkouts
ALTER TABLE "addresses" ALTER COLUMN "userId" DROP NOT NULL;
