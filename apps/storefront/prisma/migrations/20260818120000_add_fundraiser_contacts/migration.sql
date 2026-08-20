-- CreateEnum
CREATE TYPE "FundraiserContactStatus" AS ENUM ('NEW', 'CONTACTED', 'RESPONDED', 'CONVERTED', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "FundraiserContactSource" AS ENUM ('ARCHIVE_ORDER_FORM', 'ARCHIVE_ORDER_EXPORT', 'CONSTANT_CONTACT', 'WEBSITE_EXPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "FundraiserOutreachStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED_SUPPRESSED', 'SKIPPED_NO_EMAIL');

-- CreateTable
CREATE TABLE "fundraiser_contacts" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "totalJars" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "campaignCount" INTEGER NOT NULL DEFAULT 0,
    "firstCampaignAt" TIMESTAMP(3),
    "lastCampaignAt" TIMESTAMP(3),
    "years" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "FundraiserContactStatus" NOT NULL DEFAULT 'NEW',
    "lastSolicitedAt" TIMESTAMP(3),
    "solicitationCount" INTEGER NOT NULL DEFAULT 0,
    "source" "FundraiserContactSource" NOT NULL DEFAULT 'ARCHIVE_ORDER_FORM',
    "sourceFiles" TEXT[],
    "notes" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_outreach_logs" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "FundraiserOutreachStatus" NOT NULL,
    "messageId" TEXT,
    "error" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_outreach_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_contacts_email_key" ON "fundraiser_contacts"("email");

-- CreateIndex
CREATE INDEX "fundraiser_contacts_isActive_status_idx" ON "fundraiser_contacts"("isActive", "status");

-- CreateIndex
CREATE INDEX "fundraiser_contacts_organizationName_idx" ON "fundraiser_contacts"("organizationName");

-- CreateIndex
CREATE INDEX "fundraiser_contacts_lastSolicitedAt_idx" ON "fundraiser_contacts"("lastSolicitedAt");

-- CreateIndex
CREATE INDEX "fundraiser_outreach_logs_contactId_idx" ON "fundraiser_outreach_logs"("contactId");

-- CreateIndex
CREATE INDEX "fundraiser_outreach_logs_status_idx" ON "fundraiser_outreach_logs"("status");

-- CreateIndex
CREATE INDEX "fundraiser_outreach_logs_createdAt_idx" ON "fundraiser_outreach_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "fundraiser_outreach_logs" ADD CONSTRAINT "fundraiser_outreach_logs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "fundraiser_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

