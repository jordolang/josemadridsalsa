-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('NEWSLETTER', 'FUNDRAISER', 'CONTACT', 'ORDER', 'SIGNUP', 'OTHER');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('PENDING', 'CONTACTED', 'CLOSED', 'IGNORED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "confirmationEmailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "engagement_requests" (
    "id" TEXT NOT NULL,
    "type" "EngagementType" NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT,
    "email" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engagement_requests_type_status_idx" ON "engagement_requests"("type", "status");

-- CreateIndex
CREATE INDEX "engagement_requests_createdAt_idx" ON "engagement_requests"("createdAt");
