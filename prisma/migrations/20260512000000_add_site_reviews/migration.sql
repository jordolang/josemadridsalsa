-- Site-wide reviews (footer / our-story / order-confirmation) captured before optional Google handoff.
CREATE TABLE "site_reviews" (
  "id" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "name" TEXT,
  "email" TEXT,
  "source" TEXT,
  "forwardedToGoogle" BOOLEAN NOT NULL DEFAULT false,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "moderatedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "site_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_reviews_status_idx" ON "site_reviews"("status");
CREATE INDEX "site_reviews_source_idx" ON "site_reviews"("source");
CREATE INDEX "site_reviews_createdAt_idx" ON "site_reviews"("createdAt");
