-- CreateTable
CREATE TABLE "arena_game_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "fundraiserId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "arena_game_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_game_codes_code_key" ON "arena_game_codes"("code");

-- CreateIndex
CREATE INDEX "arena_game_codes_fundraiserId_idx" ON "arena_game_codes"("fundraiserId");

-- AddForeignKey
ALTER TABLE "arena_game_codes" ADD CONSTRAINT "arena_game_codes_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
