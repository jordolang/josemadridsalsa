-- Add Google Search Console fields to SEO configuration
ALTER TABLE "seo_configurations"
ADD COLUMN "googleSiteVerification" TEXT,
ADD COLUMN "gscProperty" TEXT,
ADD COLUMN "gscServiceAccountJson" TEXT;
