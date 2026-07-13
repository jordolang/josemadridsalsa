-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED');

-- AlterTable
ALTER TABLE "email_campaigns" ADD COLUMN     "listId" TEXT;

-- CreateTable
CREATE TABLE "mailing_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailing_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailing_list_subscribers" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "source" TEXT,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "mailing_list_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailing_lists_isDefault_idx" ON "mailing_lists"("isDefault");

-- CreateIndex
CREATE INDEX "mailing_list_subscribers_email_idx" ON "mailing_list_subscribers"("email");

-- CreateIndex
CREATE INDEX "mailing_list_subscribers_status_idx" ON "mailing_list_subscribers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mailing_list_subscribers_listId_email_key" ON "mailing_list_subscribers"("listId", "email");

-- CreateIndex
CREATE INDEX "email_campaigns_listId_idx" ON "email_campaigns"("listId");

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_listId_fkey" FOREIGN KEY ("listId") REFERENCES "mailing_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_list_subscribers" ADD CONSTRAINT "mailing_list_subscribers_listId_fkey" FOREIGN KEY ("listId") REFERENCES "mailing_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
