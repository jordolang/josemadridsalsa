-- Add latitude/longitude to retail locations for geospatial queries
ALTER TABLE "retail_locations"
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);
