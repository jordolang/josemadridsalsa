-- AlterTable
ALTER TABLE "time_clock_entries" ADD COLUMN     "clockInAccuracyMeters" DOUBLE PRECISION,
ADD COLUMN     "clockInLatitude" DOUBLE PRECISION,
ADD COLUMN     "clockInLongitude" DOUBLE PRECISION,
ADD COLUMN     "clockOutAccuracyMeters" DOUBLE PRECISION,
ADD COLUMN     "clockOutLatitude" DOUBLE PRECISION,
ADD COLUMN     "clockOutLongitude" DOUBLE PRECISION;
