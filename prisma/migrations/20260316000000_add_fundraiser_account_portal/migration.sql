-- AlterEnum: Add FUNDRAISER to UserRole
ALTER TYPE "UserRole" ADD VALUE 'FUNDRAISER';

-- AlterEnum: Add FUNDRAISER_PORTAL to PermissionCategory
ALTER TYPE "PermissionCategory" ADD VALUE 'FUNDRAISER_PORTAL';

-- CreateEnum: FundraiserAccountStatus
CREATE TYPE "FundraiserAccountStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- AlterTable: Add portal fields to fundraisers
ALTER TABLE "fundraisers" ADD COLUMN "subdomain" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "pageConfig" JSONB;
ALTER TABLE "fundraisers" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "coverPhotoUrl" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "missionStatement" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN "bio" TEXT;

-- CreateIndex: Unique constraint on subdomain
CREATE UNIQUE INDEX "fundraisers_subdomain_key" ON "fundraisers"("subdomain");

-- CreateTable: fundraiser_accounts
CREATE TABLE "fundraiser_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "status" "FundraiserAccountStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique on userId
CREATE UNIQUE INDEX "fundraiser_accounts_userId_key" ON "fundraiser_accounts"("userId");

-- CreateIndex: Unique on fundraiserId
CREATE UNIQUE INDEX "fundraiser_accounts_fundraiserId_key" ON "fundraiser_accounts"("fundraiserId");

-- AddForeignKey: fundraiser_accounts.userId -> users.id
ALTER TABLE "fundraiser_accounts" ADD CONSTRAINT "fundraiser_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: fundraiser_accounts.fundraiserId -> fundraisers.id
ALTER TABLE "fundraiser_accounts" ADD CONSTRAINT "fundraiser_accounts_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
