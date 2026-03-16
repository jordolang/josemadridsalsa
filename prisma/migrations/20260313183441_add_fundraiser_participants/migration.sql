-- CreateEnum
CREATE TYPE "FundraiserParticipantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "fundraiser_participants" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "referralCode" TEXT NOT NULL,
    "status" "FundraiserParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_participants_referralCode_key" ON "fundraiser_participants"("referralCode");

-- CreateIndex
CREATE INDEX "fundraiser_participants_fundraiserId_idx" ON "fundraiser_participants"("fundraiserId");

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "participantId" TEXT;

-- CreateIndex
CREATE INDEX "orders_participantId_idx" ON "orders"("participantId");

-- AddForeignKey
ALTER TABLE "fundraiser_participants" ADD CONSTRAINT "fundraiser_participants_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "fundraiser_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
