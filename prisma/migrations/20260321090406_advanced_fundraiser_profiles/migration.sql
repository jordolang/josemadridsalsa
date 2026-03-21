-- CreateTable
CREATE TABLE "fundraiser_profiles" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "customCss" TEXT,
    "liveStreamUrl" TEXT,
    "youtubeVideoUrl" TEXT,
    "tiktokFeedUrl" TEXT,
    "isAdvancedMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_access" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_analytics" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "googleMeasurementId" TEXT,
    "googleMyBusinessId" TEXT,
    "seoKeywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraiser_gamification" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "tiktokChallengesCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_gamification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_actions" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gamification_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_profiles_fundraiserId_key" ON "fundraiser_profiles"("fundraiserId");

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_access_fundraiserId_email_key" ON "fundraiser_access"("fundraiserId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_analytics_fundraiserId_key" ON "fundraiser_analytics"("fundraiserId");

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_gamification_fundraiserId_key" ON "fundraiser_gamification"("fundraiserId");

-- CreateIndex
CREATE INDEX "gamification_actions_fundraiserId_idx" ON "gamification_actions"("fundraiserId");

-- AddForeignKey
ALTER TABLE "fundraiser_profiles" ADD CONSTRAINT "fundraiser_profiles_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_access" ADD CONSTRAINT "fundraiser_access_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_analytics" ADD CONSTRAINT "fundraiser_analytics_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_gamification" ADD CONSTRAINT "fundraiser_gamification_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_actions" ADD CONSTRAINT "gamification_actions_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
