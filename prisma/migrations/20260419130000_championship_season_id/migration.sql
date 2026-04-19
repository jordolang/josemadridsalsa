-- AlterTable
ALTER TABLE "fundraiser_championships" ADD COLUMN "seasonId" TEXT;

-- CreateIndex
CREATE INDEX "fundraiser_championships_seasonId_idx" ON "fundraiser_championships"("seasonId");

-- AddForeignKey
ALTER TABLE "fundraiser_championships"
    ADD CONSTRAINT "fundraiser_championships_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "fundraiser_seasons"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
