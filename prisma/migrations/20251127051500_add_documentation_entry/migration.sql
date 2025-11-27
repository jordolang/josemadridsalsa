-- CreateEnum
CREATE TYPE "DocumentationVisibility" AS ENUM ('PUBLIC', 'DEVELOPER');

-- CreateTable
CREATE TABLE "DocumentationEntry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "visibility" "DocumentationVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sourcePath" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentationEntry_slug_key" ON "DocumentationEntry"("slug");
