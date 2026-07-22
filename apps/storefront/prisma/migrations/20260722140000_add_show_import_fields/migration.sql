-- Fields carried by the strict 20-column Show import CSV.
-- All nullable: an empty cell in that export means "not published", never zero.
ALTER TABLE "featured_events"
  ADD COLUMN "venue" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" VARCHAR(2),
  ADD COLUMN "driveTime" TEXT,
  ADD COLUMN "eventTimes" TEXT,
  ADD COLUMN "applicationDeadlineText" TEXT,
  ADD COLUMN "boothFeeEstimated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "boothFeeNote" TEXT,
  ADD COLUMN "attendance" INTEGER,
  ADD COLUMN "attendanceEstimated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "exhibitors" INTEGER,
  ADD COLUMN "exhibitorsEstimated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "costOfFuel" DECIMAL(10,2),
  ADD COLUMN "lodging" DECIMAL(10,2),
  ADD COLUMN "meals" DECIMAL(10,2),
  ADD COLUMN "applicationInfo" TEXT;
