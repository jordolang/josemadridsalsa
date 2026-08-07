-- Returns / RMA. Additive only: new enums, two new tables, and a nullable link from
-- refunds. No existing column changes, so this is safe to apply ahead of the code deploy.

CREATE TYPE "ReturnStatus" AS ENUM (
  'REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "ReturnReason" AS ENUM (
  'DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'ARRIVED_LATE',
  'CHANGED_MIND', 'QUALITY_ISSUE', 'OTHER'
);

CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'EXCHANGE', 'STORE_CREDIT');

CREATE TYPE "ReturnItemCondition" AS ENUM ('RESELLABLE', 'DAMAGED', 'DISCARDED');

CREATE TABLE "return_requests" (
  "id" TEXT NOT NULL,
  "rmaNumber" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" "ReturnReason" NOT NULL,
  "resolution" "ReturnResolution" NOT NULL DEFAULT 'REFUND',
  "customerNote" TEXT,
  "adminNote" TEXT,
  "restockingFee" DECIMAL(10,2),
  "refundId" TEXT,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "return_requests_rmaNumber_key" ON "return_requests"("rmaNumber");
-- One return may only ever point at one refund, and vice versa.
CREATE UNIQUE INDEX "return_requests_refundId_key" ON "return_requests"("refundId");
CREATE INDEX "return_requests_orderId_idx" ON "return_requests"("orderId");
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");
CREATE INDEX "return_requests_createdAt_idx" ON "return_requests"("createdAt");

ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_refundId_fkey"
  FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "return_request_items" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "condition" "ReturnItemCondition",
  "restocked" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "return_request_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "return_request_items_returnRequestId_orderItemId_key"
  ON "return_request_items"("returnRequestId", "orderItemId");
CREATE INDEX "return_request_items_orderItemId_idx" ON "return_request_items"("orderItemId");

ALTER TABLE "return_request_items"
  ADD CONSTRAINT "return_request_items_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_request_items"
  ADD CONSTRAINT "return_request_items_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
