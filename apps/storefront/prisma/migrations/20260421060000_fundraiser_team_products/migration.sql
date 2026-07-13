-- CreateTable: per-team product catalog for the Battle Arena fundraiser
CREATE TABLE "fundraiser_team_products" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_team_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_team_products_teamId_productId_key"
    ON "fundraiser_team_products"("teamId", "productId");

-- CreateIndex
CREATE INDEX "fundraiser_team_products_teamId_isActive_sortOrder_idx"
    ON "fundraiser_team_products"("teamId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "fundraiser_team_products_productId_idx"
    ON "fundraiser_team_products"("productId");

-- AddForeignKey
ALTER TABLE "fundraiser_team_products"
    ADD CONSTRAINT "fundraiser_team_products_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "fundraiser_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraiser_team_products"
    ADD CONSTRAINT "fundraiser_team_products_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
