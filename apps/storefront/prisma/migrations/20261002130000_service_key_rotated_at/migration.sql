-- AlterTable
ALTER TABLE "service_keys" ADD COLUMN "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: the last write is the best available estimate of the last rotation.
UPDATE "service_keys" SET "rotatedAt" = "updatedAt";
