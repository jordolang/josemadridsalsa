-- Vermillion Farm Market's website (vermilionfarmmarket.net) returns 404.
-- The seed data no longer carries it; clear it from the stored row too so the
-- store locator stops linking to it.
UPDATE "retail_locations"
SET "website" = NULL
WHERE "website" ILIKE '%vermilionfarmmarket.net%';
