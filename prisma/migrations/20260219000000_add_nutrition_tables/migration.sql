-- CreateTable
CREATE TABLE "nutritional_info" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "servingSize" TEXT NOT NULL,
    "servingsPerContainer" INTEGER NOT NULL DEFAULT 13,
    "calories" INTEGER NOT NULL DEFAULT 0,
    "caloriesFromFat" INTEGER NOT NULL DEFAULT 0,
    "totalFatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFatDV" INTEGER NOT NULL DEFAULT 0,
    "saturatedFatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saturatedFatDV" INTEGER NOT NULL DEFAULT 0,
    "transFatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cholesterolMg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cholesterolDV" INTEGER NOT NULL DEFAULT 0,
    "sodiumMg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodiumDV" INTEGER NOT NULL DEFAULT 0,
    "totalCarbG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCarbDV" INTEGER NOT NULL DEFAULT 0,
    "dietaryFiberG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dietaryFiberDV" INTEGER NOT NULL DEFAULT 0,
    "sugarsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vitaminADV" INTEGER NOT NULL DEFAULT 0,
    "vitaminCDV" INTEGER NOT NULL DEFAULT 0,
    "calciumDV" INTEGER NOT NULL DEFAULT 0,
    "ironDV" INTEGER NOT NULL DEFAULT 0,
    "allergens" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutritional_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "qualifier" TEXT,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutritional_info_productId_key" ON "nutritional_info"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "product_ingredients_productId_idx" ON "product_ingredients"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_ingredients_productId_ingredientId_key" ON "product_ingredients"("productId", "ingredientId");

-- AddForeignKey
ALTER TABLE "nutritional_info" ADD CONSTRAINT "nutritional_info_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
