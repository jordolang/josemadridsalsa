-- CreateTable
CREATE TABLE "fundraiser_share_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "fundraiser_share_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_share_nonces_nonce_key" ON "fundraiser_share_nonces"("nonce");

-- CreateIndex
CREATE INDEX "fundraiser_share_nonces_userId_createdAt_idx" ON "fundraiser_share_nonces"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "fundraiser_share_nonces_teamId_createdAt_idx" ON "fundraiser_share_nonces"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "fundraiser_share_nonces_expiresAt_idx" ON "fundraiser_share_nonces"("expiresAt");

-- CreateTable
CREATE TABLE "fundraiser_shield_grants" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "diminishingN" INTEGER NOT NULL DEFAULT 1,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_shield_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fundraiser_shield_grants_userId_grantedAt_idx" ON "fundraiser_shield_grants"("userId", "grantedAt");

-- CreateIndex
CREATE INDEX "fundraiser_shield_grants_userId_platform_grantedAt_idx" ON "fundraiser_shield_grants"("userId", "platform", "grantedAt");

-- CreateIndex
CREATE INDEX "fundraiser_shield_grants_teamId_grantedAt_idx" ON "fundraiser_shield_grants"("teamId", "grantedAt");
