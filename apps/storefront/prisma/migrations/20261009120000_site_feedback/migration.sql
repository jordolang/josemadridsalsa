-- CreateTable
CREATE TABLE "site_feedback" (
    "id" TEXT NOT NULL,
    "ratings" JSONB NOT NULL,
    "averageRating" DOUBLE PRECISION,
    "comment" TEXT,
    "name" TEXT,
    "email" TEXT,
    "source" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_feedback_createdAt_idx" ON "site_feedback"("createdAt");
