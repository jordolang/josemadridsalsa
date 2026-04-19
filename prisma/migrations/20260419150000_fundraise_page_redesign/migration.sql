-- AlterTable: FundraiserTeam public campaign assets (all nullable)
ALTER TABLE "fundraiser_teams"
    ADD COLUMN "logoUrl" TEXT,
    ADD COLUMN "heroImageUrl" TEXT,
    ADD COLUMN "heroVideoUrl" TEXT,
    ADD COLUMN "campaignTitle" TEXT,
    ADD COLUMN "tagline" TEXT,
    ADD COLUMN "storyHtml" TEXT;

-- AlterTable: FundraiserCharacter per-teammate totals + optional user claim
ALTER TABLE "fundraiser_characters"
    ADD COLUMN "amountRaised" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "supporterCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "avatarUrl" TEXT,
    ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "fundraiser_characters_teamId_amountRaised_idx"
    ON "fundraiser_characters"("teamId", "amountRaised" DESC);

-- CreateIndex
CREATE INDEX "fundraiser_characters_userId_idx" ON "fundraiser_characters"("userId");

-- AddForeignKey
ALTER TABLE "fundraiser_characters"
    ADD CONSTRAINT "fundraiser_characters_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: FundraiserSaleEvent — character attribution
ALTER TABLE "fundraiser_sale_events"
    ADD COLUMN "sellingCharacterId" TEXT;

-- CreateIndex
CREATE INDEX "fundraiser_sale_events_sellingCharacterId_idx"
    ON "fundraiser_sale_events"("sellingCharacterId");

-- AddForeignKey
ALTER TABLE "fundraiser_sale_events"
    ADD CONSTRAINT "fundraiser_sale_events_sellingCharacterId_fkey"
    FOREIGN KEY ("sellingCharacterId") REFERENCES "fundraiser_characters"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: reactions
CREATE TABLE "fundraiser_sale_event_reactions" (
    "id" TEXT NOT NULL,
    "saleEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_sale_event_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_sale_event_reactions_saleEventId_userId_key"
    ON "fundraiser_sale_event_reactions"("saleEventId", "userId");

-- CreateIndex
CREATE INDEX "fundraiser_sale_event_reactions_saleEventId_idx"
    ON "fundraiser_sale_event_reactions"("saleEventId");

-- CreateIndex
CREATE INDEX "fundraiser_sale_event_reactions_userId_idx"
    ON "fundraiser_sale_event_reactions"("userId");

-- AddForeignKey
ALTER TABLE "fundraiser_sale_event_reactions"
    ADD CONSTRAINT "fundraiser_sale_event_reactions_saleEventId_fkey"
    FOREIGN KEY ("saleEventId") REFERENCES "fundraiser_sale_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_sale_event_reactions"
    ADD CONSTRAINT "fundraiser_sale_event_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: replies
CREATE TABLE "fundraiser_sale_event_replies" (
    "id" TEXT NOT NULL,
    "saleEventId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_sale_event_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fundraiser_sale_event_replies_saleEventId_createdAt_idx"
    ON "fundraiser_sale_event_replies"("saleEventId", "createdAt");

-- CreateIndex
CREATE INDEX "fundraiser_sale_event_replies_authorUserId_idx"
    ON "fundraiser_sale_event_replies"("authorUserId");

-- AddForeignKey
ALTER TABLE "fundraiser_sale_event_replies"
    ADD CONSTRAINT "fundraiser_sale_event_replies_saleEventId_fkey"
    FOREIGN KEY ("saleEventId") REFERENCES "fundraiser_sale_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_sale_event_replies"
    ADD CONSTRAINT "fundraiser_sale_event_replies_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
