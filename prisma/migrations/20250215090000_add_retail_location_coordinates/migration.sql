-- Add latitude/longitude to retail locations for geospatial queries
ALTER TABLE "retail_locations"
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7);
