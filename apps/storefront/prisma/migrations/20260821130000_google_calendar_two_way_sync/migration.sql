-- Two-way Google Calendar sync.
--
-- Adds the OAuth connection row and the per-event sync state the reconciler
-- needs to tell "changed here" from "changed on Google".
--
-- Guarded with IF NOT EXISTS throughout: this delta was authored from a diff
-- against a development database that carries unrelated drift, so the
-- statements have to be safe to replay against a database that already has
-- some of it.

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "GoogleCalendarConflictPolicy" AS ENUM ('LOCAL_WINS', 'GOOGLE_WINS', 'ASK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "GoogleSyncState" AS ENUM ('IN_SYNC', 'CONFLICT', 'PUSH_FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterTable
ALTER TABLE "featured_events"
  ADD COLUMN IF NOT EXISTS "isAllDay" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "googleEtag" TEXT,
  ADD COLUMN IF NOT EXISTS "googleSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "googleSyncState" "GoogleSyncState" NOT NULL DEFAULT 'IN_SYNC',
  ADD COLUMN IF NOT EXISTS "googleSyncError" TEXT;

-- Backfill isAllDay for rows that predate the column.
--
-- Every existing date-only event came in through the Google Calendar ICS sync,
-- which parsed a bare `YYYY-MM-DD` and so stored exactly UTC midnight. Events
-- typed into the admin form always carry a wall-clock time and land on some
-- other instant. That makes "midnight UTC exactly" a reliable test here, and
-- only here — it is not a rule new writes should depend on, which is why the
-- column exists at all.
UPDATE "featured_events"
SET "isAllDay" = true
WHERE "startDate" = date_trunc('day', "startDate" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

-- CreateTable
CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "googleEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "conflictPolicy" "GoogleCalendarConflictPolicy" NOT NULL DEFAULT 'ASK',
    "lastPullAt" TIMESTAMP(3),
    "lastPushAt" TIMESTAMP(3),
    "lastPullCount" INTEGER NOT NULL DEFAULT 0,
    "lastPushCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionError" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_connections_calendarId_key"
  ON "google_calendar_connections"("calendarId");
