-- Purchase orders and receiving.
--
-- Inventory could only ever go down: sales, returns and manual adjustments all had a home,
-- but stock arriving from a supplier had none. This adds the buying side.
--
-- The shape deliberately mirrors order fulfillment, because it is the same problem pointed
-- the other way. `purchase_order_items.quantityReceived` is a cached rollup of that line's
-- receipt items, exactly as `order_items.quantityFulfilled` rolls up fulfillment items, and
-- carries the same invariant: it must equal SUM(receipt items) and may only be written by
-- the receiving path. `PARTIALLY_RECEIVED`/`RECEIVED` are derived from those quantities;
-- `DRAFT`/`SUBMITTED`/`CANCELLED` are lifecycle states a person sets.

CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
);

CREATE TABLE "suppliers" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "contactName" TEXT,
  "email"       TEXT,
  "phone"       TEXT,
  "address1"    TEXT,
  "address2"    TEXT,
  "city"        TEXT,
  "state"       TEXT,
  "postalCode"  TEXT,
  "country"     TEXT DEFAULT 'US',
  "notes"       TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

CREATE TABLE "purchase_orders" (
  "id"           TEXT NOT NULL,
  "poNumber"     TEXT NOT NULL,
  "supplierId"   TEXT NOT NULL,
  "status"       "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "expectedAt"   TIMESTAMP(3),
  "submittedAt"  TIMESTAMP(3),
  "receivedAt"   TIMESTAMP(3),
  "cancelledAt"  TIMESTAMP(3),
  "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");
CREATE INDEX "purchase_orders_expectedAt_idx" ON "purchase_orders"("expectedAt");

CREATE TABLE "purchase_order_items" (
  "id"               TEXT NOT NULL,
  "purchaseOrderId"  TEXT NOT NULL,
  "productId"        TEXT NOT NULL,
  "quantityOrdered"  INTEGER NOT NULL,
  "quantityReceived" INTEGER NOT NULL DEFAULT 0,
  "unitCost"         DECIMAL(10,2) NOT NULL,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);
-- One line per product per PO: two lines for the same product would make the received
-- rollup ambiguous and let a receipt be applied to the wrong one.
CREATE UNIQUE INDEX "purchase_order_items_purchaseOrderId_productId_key"
  ON "purchase_order_items"("purchaseOrderId", "productId");
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

CREATE TABLE "purchase_order_receipts" (
  "id"              TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "reference"       TEXT,
  "notes"           TEXT,
  "receivedById"    TEXT,
  "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_receipts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_order_receipts_purchaseOrderId_idx"
  ON "purchase_order_receipts"("purchaseOrderId");

CREATE TABLE "purchase_order_receipt_items" (
  "id"                  TEXT NOT NULL,
  "receiptId"           TEXT NOT NULL,
  "purchaseOrderItemId" TEXT NOT NULL,
  "quantity"            INTEGER NOT NULL,
  CONSTRAINT "purchase_order_receipt_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_order_receipt_items_receiptId_idx"
  ON "purchase_order_receipt_items"("receiptId");
CREATE INDEX "purchase_order_receipt_items_purchaseOrderItemId_idx"
  ON "purchase_order_receipt_items"("purchaseOrderItemId");

-- Traceability for stock that arrived from a purchase order. Without it, "where did this
-- come from" is only answerable from a free-text reason, which is not an answer.
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
CREATE INDEX "inventory_transactions_purchaseOrderId_idx"
  ON "inventory_transactions"("purchaseOrderId");

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: deleting a product must not silently erase the record of having
-- bought it. Purchase history is accounting.
ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_receipts"
  ADD CONSTRAINT "purchase_order_receipts_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_receipts"
  ADD CONSTRAINT "purchase_order_receipts_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_order_receipt_items"
  ADD CONSTRAINT "purchase_order_receipt_items_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "purchase_order_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_receipt_items"
  ADD CONSTRAINT "purchase_order_receipt_items_purchaseOrderItemId_fkey"
  FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
