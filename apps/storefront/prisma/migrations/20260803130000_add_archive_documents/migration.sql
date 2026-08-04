-- CreateEnum
CREATE TYPE "ArchiveExtractionStatus" AS ENUM ('PENDING', 'EXTRACTED', 'EMPTY', 'SCANNED_NO_TEXT', 'UNSUPPORTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ArchiveSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'SENSITIVE');

-- CreateTable
CREATE TABLE "archive_documents" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "ext" TEXT,
    "sizeBytes" INTEGER,
    "md5" TEXT,
    "originalSource" TEXT,
    "year" INTEGER,
    "textPreview" TEXT,
    "extractedText" TEXT,
    "textChars" INTEGER NOT NULL DEFAULT 0,
    "extraction" "ArchiveExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "needsOcr" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity" "ArchiveSensitivity" NOT NULL DEFAULT 'INTERNAL',
    "importSource" TEXT NOT NULL DEFAULT 'document-archive',
    "importBatchId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archive_documents_path_key" ON "archive_documents"("path");

-- CreateIndex
CREATE INDEX "archive_documents_category_idx" ON "archive_documents"("category");

-- CreateIndex
CREATE INDEX "archive_documents_year_idx" ON "archive_documents"("year");

-- CreateIndex
CREATE INDEX "archive_documents_sensitivity_idx" ON "archive_documents"("sensitivity");

-- CreateIndex
CREATE INDEX "archive_documents_extraction_idx" ON "archive_documents"("extraction");
