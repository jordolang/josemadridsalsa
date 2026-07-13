-- CreateTable
CREATE TABLE "fundraiser_messages" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT,
    "authorAvatar" TEXT,
    "authorId" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fundraiser_messages_fundraiserId_isHidden_idx" ON "fundraiser_messages"("fundraiserId", "isHidden");

-- AddForeignKey
ALTER TABLE "fundraiser_messages" ADD CONSTRAINT "fundraiser_messages_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_messages" ADD CONSTRAINT "fundraiser_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
