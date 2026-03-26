-- CreateEnum
CREATE TYPE "FundraiserTeamStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "FundraiserSignupStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "fundraiser_teams" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "activePeriod" TEXT NOT NULL,
    "status" "FundraiserTeamStatus" NOT NULL DEFAULT 'PENDING',
    "teamColor" TEXT NOT NULL DEFAULT '#9B7FFF',
    "teamColorDark" TEXT NOT NULL DEFAULT '#452E7F',
    "goalAmount" INTEGER NOT NULL DEFAULT 1000,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerUnit" INTEGER NOT NULL DEFAULT 10,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "apiKeyHash" TEXT,
    "apiKeyIssuedAt" TIMESTAMP(3),
    "apiKeyRotatedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_characters" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "characterClass" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'm',
    "skinColor" TEXT NOT NULL DEFAULT '#8B5E3C',
    "hairColor" TEXT NOT NULL DEFAULT '#1A0A00',
    "position" INTEGER NOT NULL DEFAULT 0,
    "quips" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_signup_requests" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "goalAmount" INTEGER NOT NULL DEFAULT 1000,
    "message" TEXT,
    "status" "FundraiserSignupStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "apiKeyShownAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_signup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_sale_events" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_sale_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_shields" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_shields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_teams_slug_key" ON "fundraiser_teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_teams_apiKeyHash_key" ON "fundraiser_teams"("apiKeyHash");

-- CreateIndex
CREATE INDEX "fundraiser_teams_activePeriod_idx" ON "fundraiser_teams"("activePeriod");

-- CreateIndex
CREATE INDEX "fundraiser_teams_status_idx" ON "fundraiser_teams"("status");

-- CreateIndex
CREATE INDEX "fundraiser_characters_teamId_idx" ON "fundraiser_characters"("teamId");

-- CreateIndex
CREATE INDEX "fundraiser_signup_requests_status_idx" ON "fundraiser_signup_requests"("status");

-- CreateIndex
CREATE INDEX "fundraiser_signup_requests_contactEmail_idx" ON "fundraiser_signup_requests"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_sale_events_orderId_key" ON "fundraiser_sale_events"("orderId");

-- CreateIndex
CREATE INDEX "fundraiser_sale_events_teamId_idx" ON "fundraiser_sale_events"("teamId");

-- CreateIndex
CREATE INDEX "fundraiser_shields_teamId_idx" ON "fundraiser_shields"("teamId");

-- CreateIndex
CREATE INDEX "fundraiser_shields_expiresAt_idx" ON "fundraiser_shields"("expiresAt");

-- AddForeignKey
ALTER TABLE "fundraiser_characters" ADD CONSTRAINT "fundraiser_characters_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fundraiser_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_sale_events" ADD CONSTRAINT "fundraiser_sale_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fundraiser_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_shields" ADD CONSTRAINT "fundraiser_shields_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fundraiser_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
