-- CreateEnum
CREATE TYPE "InboundEmailCategory" AS ENUM ('ORDER_STATUS', 'SHIPPING_DELIVERY', 'RETURN_OR_DAMAGE', 'PAYMENT_OR_BILLING', 'FUNDRAISER', 'WHOLESALE', 'PRODUCT_QUESTION', 'GENERAL_QUESTION', 'SPAM_OR_AUTOMATED');

-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('AUTO_ANSWERED', 'REPLY_DRAFTED', 'NEEDS_ACTION', 'IN_PROGRESS', 'RESOLVED', 'IGNORED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CUSTOMER_EMAIL';

-- CreateTable
CREATE TABLE "gmail_connections" (
    "id" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "searchQuery" TEXT NOT NULL DEFAULT 'in:inbox -in:chats -in:spam newer_than:7d',
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReplyMinConfidence" INTEGER NOT NULL DEFAULT 80,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSweepAt" TIMESTAMP(3),
    "lastSweepCount" INTEGER NOT NULL DEFAULT 0,
    "connectionError" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_emails" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "category" "InboundEmailCategory" NOT NULL DEFAULT 'GENERAL_QUESTION',
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'NEEDS_ACTION',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "actionSummary" TEXT,
    "gmailLabel" TEXT,
    "autoReplySent" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyBody" TEXT,
    "autoReplyAt" TIMESTAMP(3),
    "draftedReply" TEXT,
    "customerId" TEXT,
    "orderId" TEXT,
    "fundraiserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_email_steps" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_email_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_connections_mailbox_key" ON "gmail_connections"("mailbox");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_emails_gmailMessageId_key" ON "inbound_emails"("gmailMessageId");

-- CreateIndex
CREATE INDEX "inbound_emails_status_receivedAt_idx" ON "inbound_emails"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "inbound_emails_category_idx" ON "inbound_emails"("category");

-- CreateIndex
CREATE INDEX "inbound_emails_gmailThreadId_idx" ON "inbound_emails"("gmailThreadId");

-- CreateIndex
CREATE INDEX "inbound_email_steps_emailId_position_idx" ON "inbound_email_steps"("emailId", "position");

-- AddForeignKey
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "gmail_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_email_steps" ADD CONSTRAINT "inbound_email_steps_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "inbound_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
