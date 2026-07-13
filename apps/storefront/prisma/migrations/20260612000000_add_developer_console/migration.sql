-- AlterEnum
ALTER TYPE "PermissionCategory" ADD VALUE 'DEVELOPER';

-- CreateTable
CREATE TABLE "developer_page_content" (
    "id" TEXT NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'singleton',
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "developer_page_content_singleton_key" ON "developer_page_content"("singleton");
