-- CreateEnum
CREATE TYPE "EventBookingStatus" AS ENUM ('INTERESTED', 'APPLIED', 'WAITLISTED', 'ACCEPTED', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('MANUAL', 'GOOGLE_CALENDAR', 'FESTIVALNET');

-- AlterTable
ALTER TABLE "featured_events"
    ADD COLUMN "applicationDeadline" TIMESTAMP(3),
    ADD COLUMN "bookingStatus" "EventBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    ADD COLUMN "boothFee" DECIMAL(10,2),
    ADD COLUMN "source" "EventSource" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "externalId" TEXT;

-- Backfill: rows that arrived via calendar sync are tagged as such so a future
-- re-sync can tell them apart from hand-entered shows.
UPDATE "featured_events"
SET "source" = 'GOOGLE_CALENDAR', "externalId" = "googleEventId"
WHERE "googleEventId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "featured_events_source_externalId_key" ON "featured_events"("source", "externalId");

-- CreateIndex
CREATE INDEX "featured_events_applicationDeadline_idx" ON "featured_events"("applicationDeadline");

-- CreateIndex
CREATE INDEX "featured_events_bookingStatus_startDate_idx" ON "featured_events"("bookingStatus", "startDate");
