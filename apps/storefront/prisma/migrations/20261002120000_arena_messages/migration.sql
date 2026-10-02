-- CreateTable
CREATE TABLE "arena_messages" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "teamId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arena_messages_period_createdAt_idx" ON "arena_messages"("period", "createdAt");

-- CreateIndex
CREATE INDEX "arena_messages_authorUserId_idx" ON "arena_messages"("authorUserId");

-- AddForeignKey
ALTER TABLE "arena_messages" ADD CONSTRAINT "arena_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
