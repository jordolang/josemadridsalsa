-- AlterTable
ALTER TABLE "fundraiser_messages" ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "fundraisers" ADD COLUMN     "enableSocialFeatures" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "fundraiser_championships" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "winningFundraiserId" TEXT NOT NULL,
    "winningParticipantId" TEXT,
    "prizeAmount" DECIMAL(10,2) NOT NULL,
    "scholarshipAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_championships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_championships_month_year_key" ON "fundraiser_championships"("month", "year");

-- CreateIndex
CREATE INDEX "fundraiser_messages_orderId_idx" ON "fundraiser_messages"("orderId");

-- AddForeignKey
ALTER TABLE "fundraiser_messages" ADD CONSTRAINT "fundraiser_messages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
