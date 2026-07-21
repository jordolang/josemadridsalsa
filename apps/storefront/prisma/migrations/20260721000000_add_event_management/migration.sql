-- Event management: staff/attendees, on-file contacts, and a packing manifest
-- (products taken vs. returned, with units sold derived) for each featured event.
-- All additions are new tables plus one defaulted column on products, so existing
-- rows are unaffected.

-- CreateEnum
CREATE TYPE "EventManifestStatus" AS ENUM ('DRAFT', 'PACKED', 'RETURNED');

-- AlterTable: jars-per-case pack size, used to convert cases <-> jars on manifests
ALTER TABLE "products" ADD COLUMN "unitsPerCase" INTEGER NOT NULL DEFAULT 12;

-- CreateTable
CREATE TABLE "event_staff" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_contacts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_manifests" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "EventManifestStatus" NOT NULL DEFAULT 'DRAFT',
    "packedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_manifest_items" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "takenCases" INTEGER NOT NULL DEFAULT 0,
    "takenJars" INTEGER NOT NULL DEFAULT 0,
    "returnedCases" INTEGER NOT NULL DEFAULT 0,
    "returnedJars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_manifest_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_staff_eventId_idx" ON "event_staff"("eventId");

-- CreateIndex
CREATE INDEX "event_contacts_eventId_idx" ON "event_contacts"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_manifests_eventId_key" ON "event_manifests"("eventId");

-- CreateIndex
CREATE INDEX "event_manifest_items_manifestId_idx" ON "event_manifest_items"("manifestId");

-- CreateIndex
CREATE UNIQUE INDEX "event_manifest_items_manifestId_productId_key" ON "event_manifest_items"("manifestId", "productId");

-- AddForeignKey
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "featured_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_contacts" ADD CONSTRAINT "event_contacts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "featured_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_manifests" ADD CONSTRAINT "event_manifests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "featured_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_manifest_items" ADD CONSTRAINT "event_manifest_items_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "event_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_manifest_items" ADD CONSTRAINT "event_manifest_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
