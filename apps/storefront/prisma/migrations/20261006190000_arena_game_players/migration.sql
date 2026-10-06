-- CreateEnum
CREATE TYPE "ArenaMatchMode" AS ENUM ('CPU', 'ONLINE', 'TOURNAMENT');

-- CreateTable
CREATE TABLE "arena_players" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "handleKey" TEXT NOT NULL,
    "teamId" TEXT,
    "teamChangedAt" TIMESTAMP(3),
    "matches" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "roundsWon" INTEGER NOT NULL DEFAULT 0,
    "knockouts" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_player_sessions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "arena_player_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_matches" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "mode" "ArenaMatchMode" NOT NULL,
    "fighter" TEXT,
    "opponents" INTEGER NOT NULL DEFAULT 0,
    "room" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "win" INTEGER NOT NULL DEFAULT 0,
    "roundsWon" INTEGER NOT NULL DEFAULT 0,
    "knockouts" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "arena_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_players_userId_key" ON "arena_players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "arena_players_handleKey_key" ON "arena_players"("handleKey");

-- CreateIndex
CREATE INDEX "arena_players_teamId_idx" ON "arena_players"("teamId");

-- CreateIndex
CREATE INDEX "arena_players_wins_idx" ON "arena_players"("wins");

-- CreateIndex
CREATE UNIQUE INDEX "arena_player_sessions_tokenHash_key" ON "arena_player_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "arena_player_sessions_playerId_idx" ON "arena_player_sessions"("playerId");

-- CreateIndex
CREATE INDEX "arena_matches_playerId_startedAt_idx" ON "arena_matches"("playerId", "startedAt");

-- CreateIndex
CREATE INDEX "arena_matches_finishedAt_idx" ON "arena_matches"("finishedAt");

-- CreateIndex
CREATE INDEX "arena_matches_teamId_finishedAt_idx" ON "arena_matches"("teamId", "finishedAt");

-- AddForeignKey
ALTER TABLE "arena_players" ADD CONSTRAINT "arena_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_players" ADD CONSTRAINT "arena_players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fundraiser_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_player_sessions" ADD CONSTRAINT "arena_player_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fundraiser_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

