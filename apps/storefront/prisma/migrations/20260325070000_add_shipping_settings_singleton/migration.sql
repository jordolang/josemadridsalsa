-- AlterTable: Add singleton column to shipping_settings for upsert pattern
-- This ensures only one row of shipping settings can exist

-- Add the singleton column with a default value
ALTER TABLE "shipping_settings" ADD COLUMN IF NOT EXISTS "singleton" TEXT NOT NULL DEFAULT 'singleton';

-- Create unique index on singleton to enforce single-row constraint
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_settings_singleton_key" ON "shipping_settings"("singleton");
