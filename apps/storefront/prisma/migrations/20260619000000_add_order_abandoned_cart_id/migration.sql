-- AlterTable: Add abandonedCartId to Order for recovery attribution
ALTER TABLE "orders"
    ADD COLUMN "abandonedCartId" TEXT;

-- CreateIndex: Index for analytics queries on recovered orders
CREATE INDEX "orders_abandonedCartId_idx"
    ON "orders"("abandonedCartId");

-- AddForeignKey: Link Order to AbandonedCart for attribution
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_abandonedCartId_fkey"
    FOREIGN KEY ("abandonedCartId") REFERENCES "abandoned_carts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
