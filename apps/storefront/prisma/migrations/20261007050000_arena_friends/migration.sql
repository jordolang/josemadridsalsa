-- CreateEnum
CREATE TYPE "ArenaFriendStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "arena_players" ADD COLUMN "seenAt" TIMESTAMP(3),
ADD COLUMN "room" TEXT;

-- CreateTable
CREATE TABLE "arena_friends" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "ArenaFriendStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "arena_friends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_room_invites" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_room_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_friends_requesterId_addresseeId_key" ON "arena_friends"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "arena_friends_addresseeId_status_idx" ON "arena_friends"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "arena_room_invites_toId_expiresAt_idx" ON "arena_room_invites"("toId", "expiresAt");

-- CreateIndex
CREATE INDEX "arena_room_invites_fromId_createdAt_idx" ON "arena_room_invites"("fromId", "createdAt");

-- AddForeignKey
ALTER TABLE "arena_friends" ADD CONSTRAINT "arena_friends_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_friends" ADD CONSTRAINT "arena_friends_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_room_invites" ADD CONSTRAINT "arena_room_invites_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_room_invites" ADD CONSTRAINT "arena_room_invites_toId_fkey" FOREIGN KEY ("toId") REFERENCES "arena_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
