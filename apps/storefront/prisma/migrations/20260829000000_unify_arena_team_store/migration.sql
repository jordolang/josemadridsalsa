-- Unify the Battle Arena team shop with the fundraiser store.
--
-- A FundraiserTeam is the arena presence of a campaign, not a campaign of its own. The two
-- were already paired by slug — /api/admin/fundraisers/[id]/battle-arena creates a team with
-- `slug = fundraiser.slug` and deletes it by the same key — so this records the relation that
-- already existed rather than inventing one, and creates a campaign only for the teams that
-- were approved straight from a signup and never had one.

-- ── 1. One catalog ───────────────────────────────────────────────────────────
-- fundraiser_products absorbs the ordering column that only the team catalog had.
ALTER TABLE "fundraiser_products" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "fundraiser_products_fundraiserId_isActive_sortOrder_idx"
  ON "fundraiser_products"("fundraiserId", "isActive", "sortOrder");

-- ── 2. Link teams to campaigns ───────────────────────────────────────────────
ALTER TABLE "fundraiser_teams" ADD COLUMN "fundraiserId" TEXT;

-- The pairing that already exists: same slug.
UPDATE "fundraiser_teams" t
   SET "fundraiserId" = f."id"
  FROM "fundraisers" f
 WHERE f."slug" = t."slug"
   AND t."fundraiserId" IS NULL;

-- Teams approved from a signup never had a campaign. Build one from the team's own details,
-- carrying its price per jar across as the store price so nothing it sells changes price.
-- `gen_random_uuid()` is only an id here; it never reaches a URL.
INSERT INTO "fundraisers" (
  "id", "name", "slug", "organizationName", "contactEmail", "contactPhone",
  "startDate", "endDate", "goal", "commissionRate", "defaultUnitPrice",
  "status", "isActive", "createdAt", "updatedAt"
)
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  t."name",
  t."slug",
  t."school",
  t."contactEmail",
  t."contactPhone",
  t."createdAt",
  -- Arena seasons are monthly; without one, leave a year's runway rather than a campaign
  -- that reads as already over. An admin sets real dates on the campaign page.
  COALESCE(s."endsAt", t."createdAt" + INTERVAL '1 year'),
  NULLIF(t."goalAmount", 0)::numeric(10,2),
  50.00,
  t."pricePerUnit"::numeric(10,2),
  CASE WHEN t."status" = 'ACTIVE' THEN 'ACTIVE' ELSE 'DRAFT' END::"FundraiserStatus",
  t."status" = 'ACTIVE',
  t."createdAt",
  NOW()
  FROM "fundraiser_teams" t
  LEFT JOIN "fundraiser_seasons" s ON s."id" = t."seasonId"
 WHERE t."fundraiserId" IS NULL;

UPDATE "fundraiser_teams" t
   SET "fundraiserId" = f."id"
  FROM "fundraisers" f
 WHERE f."slug" = t."slug"
   AND t."fundraiserId" IS NULL;

-- ── 3. Move the team catalog onto the campaign ───────────────────────────────
-- A campaign that already carries the product keeps its own price: the fundraiser store is
-- the side that was already charging what it advertised.
INSERT INTO "fundraiser_products" ("id", "fundraiserId", "productId", "price", "sortOrder", "isActive", "createdAt")
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  t."fundraiserId",
  tp."productId",
  tp."price",
  tp."sortOrder",
  tp."isActive",
  tp."createdAt"
  FROM "fundraiser_team_products" tp
  JOIN "fundraiser_teams" t ON t."id" = tp."teamId"
 WHERE t."fundraiserId" IS NOT NULL
ON CONFLICT ("fundraiserId", "productId") DO NOTHING;

DROP TABLE "fundraiser_team_products";

-- ── 4. One price per jar, held by the campaign ───────────────────────────────
-- Where a team carried a price and its campaign was still on the default, the team's price
-- wins: it is what its supporters were being quoted.
UPDATE "fundraisers" f
   SET "defaultUnitPrice" = t."pricePerUnit"::numeric(10,2)
  FROM "fundraiser_teams" t
 WHERE t."fundraiserId" = f."id"
   AND f."defaultUnitPrice" = 10.00
   AND t."pricePerUnit" <> 10;

ALTER TABLE "fundraiser_teams" DROP COLUMN "pricePerUnit";

-- ── 5. Every team now has a campaign ─────────────────────────────────────────
ALTER TABLE "fundraiser_teams" ALTER COLUMN "fundraiserId" SET NOT NULL;
CREATE UNIQUE INDEX "fundraiser_teams_fundraiserId_key" ON "fundraiser_teams"("fundraiserId");
ALTER TABLE "fundraiser_teams"
  ADD CONSTRAINT "fundraiser_teams_fundraiserId_fkey"
  FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
