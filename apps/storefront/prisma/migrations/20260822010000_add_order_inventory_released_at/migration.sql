-- Marks the moment an order's inventory reservation was handed back.
--
-- Reservations are taken before the order row exists, so the RESERVATION rows in
-- inventory_transactions carry no orderId and "has this order's stock already been
-- released?" cannot be derived from them. Releasing twice silently under-counts
-- products.stockReserved, so every release path claims this column first.
--
-- Nullable and additive: existing orders read as "not released", which is correct for
-- everything already paid and fulfilled.
ALTER TABLE "orders" ADD COLUMN "inventoryReleasedAt" TIMESTAMP(3);
