-- Live chat handoff: customer threads (WAITING/ACTIVE/CLOSED/OFFLINE) + per-message rows.
-- NOTE: messages live in `chat_handoff_messages` to avoid colliding with the existing
-- `chat_messages` table used by the AI chat (ChatMessage / ChatConversation models).
CREATE TYPE "ChatThreadStatus" AS ENUM ('WAITING', 'ACTIVE', 'CLOSED', 'OFFLINE');
CREATE TYPE "ChatMessageSender" AS ENUM ('CUSTOMER', 'AI', 'ADMIN', 'SYSTEM');

CREATE TABLE "chat_threads" (
  "id" TEXT NOT NULL,
  "status" "ChatThreadStatus" NOT NULL DEFAULT 'WAITING',
  "source" TEXT,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerUserId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "assignedAdminId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "closedReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_threads_status_idx" ON "chat_threads"("status");
CREATE INDEX "chat_threads_assignedAdminId_idx" ON "chat_threads"("assignedAdminId");
CREATE INDEX "chat_threads_lastMessageAt_idx" ON "chat_threads"("lastMessageAt");
CREATE INDEX "chat_threads_startedAt_idx" ON "chat_threads"("startedAt");

CREATE TABLE "chat_handoff_messages" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderType" "ChatMessageSender" NOT NULL,
  "senderUserId" TEXT,
  "senderLabel" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_handoff_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_handoff_messages_threadId_createdAt_idx" ON "chat_handoff_messages"("threadId", "createdAt");

ALTER TABLE "chat_handoff_messages"
  ADD CONSTRAINT "chat_handoff_messages_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
