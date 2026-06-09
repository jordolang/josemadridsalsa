-- AlterTable
ALTER TABLE "fundraiser_teams"
ADD COLUMN "hpCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "hpResetAt" TIMESTAMP(3),
ADD COLUMN "lastShareUserId" TEXT,
ADD COLUMN "consecutiveShares" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "fundraiser_shields"
ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "fundraiser_share_events" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_share_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fundraiser_share_events_teamId_createdAt_idx" ON "fundraiser_share_events"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "fundraiser_share_events_userId_createdAt_idx" ON "fundraiser_share_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "fundraiser_share_events" ADD CONSTRAINT "fundraiser_share_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fundraiser_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
