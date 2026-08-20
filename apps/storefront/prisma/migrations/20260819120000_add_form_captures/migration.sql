-- CreateEnum
CREATE TYPE "CaptureFormType" AS ENUM ('SHOW_SETTLEMENT', 'FARMERS_MARKET', 'FUNDRAISER_ORDER', 'MILEAGE_LOG', 'EXPENSE_RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'NEEDS_REVIEW', 'APPROVED', 'POSTED', 'FAILED', 'REJECTED');

-- AlterEnum
-- Safe inside the migration transaction on PG12+: the value is added here but never referenced
-- until a later statement in a later transaction.
ALTER TYPE "LedgerSource" ADD VALUE 'FORM_CAPTURE';

-- CreateTable
CREATE TABLE "form_captures" (
    "id" TEXT NOT NULL,
    "formType" "CaptureFormType" NOT NULL,
    "status" "CaptureStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileHash" TEXT NOT NULL,
    "capturedOn" TIMESTAMP(3),
    "eventId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedAt" TIMESTAMP(3),
    "extractionModel" TEXT,
    "rawExtraction" JSONB,
    "extractionError" TEXT,
    "minConfidence" DECIMAL(4,3),
    "statedTotalCents" INTEGER,
    "reconciled" BOOLEAN,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "duplicateOfId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_capture_lines" (
    "id" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "category" "LedgerCategory" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "quantity" INTEGER,
    "confidence" DECIMAL(4,3),
    "rawValue" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_capture_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_captures_fileHash_key" ON "form_captures"("fileHash");
CREATE INDEX "form_captures_status_idx" ON "form_captures"("status");
CREATE INDEX "form_captures_formType_capturedOn_idx" ON "form_captures"("formType", "capturedOn");
CREATE INDEX "form_captures_eventId_idx" ON "form_captures"("eventId");
CREATE INDEX "form_captures_uploadedById_idx" ON "form_captures"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "form_capture_lines_ledgerEntryId_key" ON "form_capture_lines"("ledgerEntryId");
CREATE INDEX "form_capture_lines_captureId_idx" ON "form_capture_lines"("captureId");
CREATE UNIQUE INDEX "form_capture_lines_captureId_lineNumber_key" ON "form_capture_lines"("captureId", "lineNumber");

-- AddForeignKey
ALTER TABLE "form_capture_lines" ADD CONSTRAINT "form_capture_lines_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "form_captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
