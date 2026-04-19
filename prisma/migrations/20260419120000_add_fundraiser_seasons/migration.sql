-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "fundraiser_seasons" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "rulesJson" JSONB,
    "championTeamId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_seasons_period_key" ON "fundraiser_seasons"("period");

-- CreateIndex
CREATE INDEX "fundraiser_seasons_status_idx" ON "fundraiser_seasons"("status");

-- AlterTable
ALTER TABLE "fundraiser_teams" ADD COLUMN "seasonId" TEXT;

-- CreateIndex
CREATE INDEX "fundraiser_teams_seasonId_idx" ON "fundraiser_teams"("seasonId");

-- Backfill: create one FundraiserSeason per distinct activePeriod observed
-- on fundraiser_teams, then link teams back to the newly-minted season.
-- startsAt = first day of period (UTC), endsAt = first day of next month (UTC).
-- Existing teams represent historical runs, so status=ENDED.
WITH distinct_periods AS (
    SELECT DISTINCT "activePeriod" AS period
    FROM "fundraiser_teams"
    WHERE "activePeriod" ~ '^[0-9]{4}-[0-9]{2}$'
),
inserted AS (
    INSERT INTO "fundraiser_seasons" (
        "id", "period", "startsAt", "endsAt", "status", "createdAt", "updatedAt"
    )
    SELECT
        'fs_' || md5(period) AS id,
        period,
        (period || '-01T00:00:00Z')::timestamp AS "startsAt",
        ((period || '-01')::date + INTERVAL '1 month')::timestamp AS "endsAt",
        'ENDED'::"SeasonStatus" AS status,
        NOW() AS "createdAt",
        NOW() AS "updatedAt"
    FROM distinct_periods
    RETURNING "id", "period"
)
UPDATE "fundraiser_teams" t
SET "seasonId" = s."id"
FROM "fundraiser_seasons" s
WHERE t."activePeriod" = s."period"
  AND t."seasonId" IS NULL;

-- AddForeignKey
ALTER TABLE "fundraiser_teams"
    ADD CONSTRAINT "fundraiser_teams_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "fundraiser_seasons"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_seasons"
    ADD CONSTRAINT "fundraiser_seasons_championTeamId_fkey"
    FOREIGN KEY ("championTeamId") REFERENCES "fundraiser_teams"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
