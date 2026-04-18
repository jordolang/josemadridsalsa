-- AlterTable
ALTER TABLE "fundraiser_sale_events"
ADD COLUMN "donorUserId" TEXT,
ADD COLUMN "donorName" TEXT,
ADD COLUMN "donorAvatarUrl" TEXT,
ADD COLUMN "donorEmail" TEXT,
ADD COLUMN "donorComment" TEXT,
ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "fundraiser_sale_events_donorUserId_idx" ON "fundraiser_sale_events"("donorUserId");

-- AddForeignKey
ALTER TABLE "fundraiser_sale_events"
ADD CONSTRAINT "fundraiser_sale_events_donorUserId_fkey"
FOREIGN KEY ("donorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
