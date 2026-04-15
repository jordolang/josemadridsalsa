-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('SCHOOL_ATHLETICS', 'LOCAL_BUSINESS', 'LOCAL_SCHOOL');

-- AlterTable: lead_campaigns
ALTER TABLE "lead_campaigns" ADD COLUMN "leadType" "LeadType" NOT NULL DEFAULT 'SCHOOL_ATHLETICS';
ALTER TABLE "lead_campaigns" ADD COLUMN "searchQuery" TEXT;
ALTER TABLE "lead_campaigns" ADD COLUMN "businessCategory" TEXT;
ALTER TABLE "lead_campaigns" ADD COLUMN "radius" TEXT;

-- AlterTable: leads
ALTER TABLE "leads" ADD COLUMN "businessName" TEXT;
ALTER TABLE "leads" ADD COLUMN "businessCategory" TEXT;
ALTER TABLE "leads" ADD COLUMN "address" TEXT;
ALTER TABLE "leads" ADD COLUMN "rating" DOUBLE PRECISION;
ALTER TABLE "leads" ADD COLUMN "reviewCount" INTEGER;
ALTER TABLE "leads" ADD COLUMN "website" TEXT;
ALTER TABLE "leads" ADD COLUMN "googleMapsUrl" TEXT;
ALTER TABLE "leads" ADD COLUMN "placeId" TEXT;
