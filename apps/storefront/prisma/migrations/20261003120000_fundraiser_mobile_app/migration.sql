-- Mobile fundraiser app: group ID + group PIN per fundraiser, one organizer seat,
-- per-seller PINs and device sessions.

-- AlterTable
ALTER TABLE "fundraisers" ADD COLUMN "appGroupCode" TEXT,
ADD COLUMN "appGroupPinHash" TEXT,
ADD COLUMN "appGroupPinFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "appGroupLockedUntil" TIMESTAMP(3),
ADD COLUMN "appEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "appOrganizerId" TEXT;

-- AlterTable: sellers who register in the app give their name, not an email.
ALTER TABLE "fundraiser_participants" ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "appPinHash" TEXT,
ADD COLUMN "appPinSetAt" TIMESTAMP(3),
ADD COLUMN "appPinFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "appPinLockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "fundraiser_app_sessions" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_app_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraisers_appGroupCode_key" ON "fundraisers"("appGroupCode");

-- CreateIndex
CREATE UNIQUE INDEX "fundraisers_appOrganizerId_key" ON "fundraisers"("appOrganizerId");

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_app_sessions_tokenHash_key" ON "fundraiser_app_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "fundraiser_app_sessions_participantId_idx" ON "fundraiser_app_sessions"("participantId");

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_appOrganizerId_fkey" FOREIGN KEY ("appOrganizerId") REFERENCES "fundraiser_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_app_sessions" ADD CONSTRAINT "fundraiser_app_sessions_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "fundraiser_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
