-- Add taxCode column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "taxCode" TEXT;
