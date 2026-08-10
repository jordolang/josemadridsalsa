-- Phase 1 (Structural): separate fulfillment state from order state, give orders a real
-- sales channel, give refunds a provider, and add an append-only domain event log.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "FulfillmentStatus" AS ENUM (
  'UNFULFILLED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'DELIVERED',
  'RETURNED'
);

CREATE TYPE "SalesChannel" AS ENUM (
  'WEBSITE',
  'POS',
  'FUNDRAISER',
  'WHOLESALE',
  'MANUAL',
  'MARKETPLACE',
  'PHONE',
  'IMPORT'
);

-- ---------------------------------------------------------------------------
-- Orders: fulfillment + channel
-- ---------------------------------------------------------------------------

ALTER TABLE "orders"
  ADD COLUMN "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
  ADD COLUMN "salesChannel" "SalesChannel" NOT NULL DEFAULT 'WEBSITE';

ALTER TABLE "order_items"
  ADD COLUMN "quantityFulfilled" INTEGER NOT NULL DEFAULT 0;

-- Backfill fulfillment from the signals that already exist. Without this every
-- historical shipped and delivered order would read as UNFULFILLED, and the first
-- report run off the new column would claim the business has never shipped anything.
UPDATE "orders"
SET "fulfillmentStatus" = 'DELIVERED'
WHERE "status" = 'DELIVERED' OR "deliveredAt" IS NOT NULL;

UPDATE "orders"
SET "fulfillmentStatus" = 'FULFILLED'
WHERE "fulfillmentStatus" = 'UNFULFILLED'
  AND ("status" = 'SHIPPED' OR "shippedAt" IS NOT NULL);

-- A returned/refunded order that never shipped stays UNFULFILLED; one that did ship
-- and was then refunded is recorded as RETURNED so it drops out of shipping queues.
UPDATE "orders"
SET "fulfillmentStatus" = 'RETURNED'
WHERE "status" = 'REFUNDED'
  AND ("shippedAt" IS NOT NULL OR "deliveredAt" IS NOT NULL);

-- Items on an order we just marked fully shipped are fully fulfilled. Orders left
-- UNFULFILLED keep quantityFulfilled = 0, which the default already gave us.
UPDATE "order_items" oi
SET "quantityFulfilled" = oi."quantity"
FROM "orders" o
WHERE oi."orderId" = o."id"
  AND o."fulfillmentStatus" IN ('FULFILLED', 'DELIVERED', 'RETURNED');

-- Sales channel backfill. The conditions below overlap in reality (a fundraiser sale
-- can be taken on the POS terminal), so precedence is a deliberate business choice
-- rather than a side effect of statement order:
--   1. fundraiser  — attribution to a campaign matters more than the terminal used
--   2. POS         — in-person sales
--   3. marketplace — orders that arrived from Shopify
--   4. import      — historical/migrated rows
--   5. website     — the default
UPDATE "orders"
SET "salesChannel" = CASE
  WHEN "fundraiserId" IS NOT NULL OR "participantId" IS NOT NULL THEN 'FUNDRAISER'::"SalesChannel"
  WHEN "paymentChannel" = 'POS' THEN 'POS'::"SalesChannel"
  WHEN "shopifyOrderId" IS NOT NULL THEN 'MARKETPLACE'::"SalesChannel"
  WHEN "importSource" IS NOT NULL THEN 'IMPORT'::"SalesChannel"
  ELSE 'WEBSITE'::"SalesChannel"
END;

CREATE INDEX "orders_fulfillmentStatus_idx" ON "orders"("fulfillmentStatus");
CREATE INDEX "orders_salesChannel_idx" ON "orders"("salesChannel");

-- ---------------------------------------------------------------------------
-- Fulfillments
-- ---------------------------------------------------------------------------

CREATE TABLE "fulfillments" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "FulfillmentStatus" NOT NULL DEFAULT 'FULFILLED',
  "trackingNumber" TEXT,
  "carrierName" TEXT,
  "trackingUrl" TEXT,
  "shippingLabelId" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fulfillments_orderId_idx" ON "fulfillments"("orderId");
CREATE INDEX "fulfillments_status_idx" ON "fulfillments"("status");

ALTER TABLE "fulfillments"
  ADD CONSTRAINT "fulfillments_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "fulfillment_items" (
  "id" TEXT NOT NULL,
  "fulfillmentId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "fulfillment_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fulfillment_items_fulfillmentId_orderItemId_key"
  ON "fulfillment_items"("fulfillmentId", "orderItemId");
CREATE INDEX "fulfillment_items_orderItemId_idx" ON "fulfillment_items"("orderItemId");

ALTER TABLE "fulfillment_items"
  ADD CONSTRAINT "fulfillment_items_fulfillmentId_fkey"
  FOREIGN KEY ("fulfillmentId") REFERENCES "fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fulfillment_items"
  ADD CONSTRAINT "fulfillment_items_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Refunds: identify the processor
-- ---------------------------------------------------------------------------

-- `stripeRefundId` is deliberately NOT renamed. Prisma would emit DROP + ADD for a
-- rename, destroying every stored refund ID; the missing provider column is the
-- actual defect, and PayPal/Square already write their own IDs into that field.
ALTER TABLE "refunds"
  ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE';

UPDATE "refunds" r
SET "provider" = COALESCE(p."provider", 'STRIPE'::"PaymentProvider")
FROM "payments" p
WHERE r."paymentId" = p."id";

CREATE INDEX "refunds_provider_idx" ON "refunds"("provider");

-- ---------------------------------------------------------------------------
-- Domain events
-- ---------------------------------------------------------------------------

CREATE TABLE "domain_events" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payload" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "domain_events_entityType_entityId_createdAt_idx"
  ON "domain_events"("entityType", "entityId", "createdAt");
CREATE INDEX "domain_events_type_createdAt_idx" ON "domain_events"("type", "createdAt");
CREATE INDEX "domain_events_createdAt_idx" ON "domain_events"("createdAt");
