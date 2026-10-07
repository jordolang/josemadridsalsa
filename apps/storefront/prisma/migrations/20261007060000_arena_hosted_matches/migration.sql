-- AlterEnum
ALTER TYPE "ArenaMatchMode" ADD VALUE 'RANKED';

-- AlterTable
ALTER TABLE "arena_players" ADD COLUMN "versusMatches" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "versusWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "versusKnockouts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN "rankedGames" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "arena_matches" ADD COLUMN "hostedMatchId" TEXT,
ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ratingDelta" INTEGER;

-- CreateTable
CREATE TABLE "arena_hosted_matches" (
    "id" TEXT NOT NULL,
    "hostPlayerId" TEXT NOT NULL,
    "mode" "ArenaMatchMode" NOT NULL,
    "room" TEXT,
    "fighters" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedAt" TIMESTAMP(3),

    CONSTRAINT "arena_hosted_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_hosted_seats" (
    "id" TEXT NOT NULL,
    "hostedMatchId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "ticketHash" TEXT,
    "playerId" TEXT,
    "teamId" TEXT,
    "fighter" TEXT,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "arena_hosted_seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arena_players_versusWins_idx" ON "arena_players"("versusWins");

-- CreateIndex
CREATE INDEX "arena_players_rating_idx" ON "arena_players"("rating");

-- CreateIndex
CREATE INDEX "arena_matches_verified_finishedAt_idx" ON "arena_matches"("verified", "finishedAt");

-- CreateIndex
CREATE INDEX "arena_matches_hostedMatchId_idx" ON "arena_matches"("hostedMatchId");

-- CreateIndex
CREATE INDEX "arena_hosted_matches_hostPlayerId_startedAt_idx" ON "arena_hosted_matches"("hostPlayerId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "arena_hosted_seats_ticketHash_key" ON "arena_hosted_seats"("ticketHash");

-- CreateIndex
CREATE INDEX "arena_hosted_seats_playerId_idx" ON "arena_hosted_seats"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "arena_hosted_seats_hostedMatchId_seat_key" ON "arena_hosted_seats"("hostedMatchId", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "arena_hosted_seats_hostedMatchId_playerId_key" ON "arena_hosted_seats"("hostedMatchId", "playerId");

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_hostedMatchId_fkey" FOREIGN KEY ("hostedMatchId") REFERENCES "arena_hosted_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_hosted_matches" ADD CONSTRAINT "arena_hosted_matches_hostPlayerId_fkey" FOREIGN KEY ("hostPlayerId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_hosted_seats" ADD CONSTRAINT "arena_hosted_seats_hostedMatchId_fkey" FOREIGN KEY ("hostedMatchId") REFERENCES "arena_hosted_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_hosted_seats" ADD CONSTRAINT "arena_hosted_seats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
