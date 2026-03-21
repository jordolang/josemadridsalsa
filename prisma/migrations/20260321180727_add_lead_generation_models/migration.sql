-- CreateEnum
CREATE TYPE "LeadCampaignStatus" AS ENUM ('DRAFT', 'SCRAPING', 'SCRAPE_COMPLETED', 'PARSING_CONTACTS', 'PARSING_COMPLETED', 'SENDING_EMAILS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('SCRAPED', 'CONTACT_FOUND', 'EMAIL_SENT', 'EMAIL_FAILED');

-- CreateTable
CREATE TABLE "lead_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchTerm" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "limit" INTEGER,
    "skipNoEmail" BOOLEAN NOT NULL DEFAULT true,
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "totalEmailsFound" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "rating" TEXT,
    "reviewsCount" TEXT,
    "category" TEXT,
    "plusCode" TEXT,
    "googleUrl" TEXT,
    "scrapedEmail" TEXT,
    "scrapedPhone" TEXT,
    "contactName" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'SCRAPED',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_campaignId_idx" ON "leads"("campaignId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- AddForeignKey
ALTER TABLE "lead_campaigns" ADD CONSTRAINT "lead_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "lead_email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "lead_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
