const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const ingredientsFilePath = path.join(__dirname, '..', 'data', 'ingredients.json');

// Helper to normalize a string for comparison
function normalizeString(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function main() {
  try {
    const ingredientsData = JSON.parse(fs.readFileSync(ingredientsFilePath, 'utf-8'));

    // Fetch all products from the database to create a mapping
    const dbProducts = await prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    const slugToProductIdMap = new Map();
    const normalizedNameToProductIdMap = new Map();

    dbProducts.forEach(product => {
      slugToProductIdMap.set(product.slug, product.id);
      normalizedNameToProductIdMap.set(normalizeString(product.name), product.id);
    });

    for (const scrapedSlug in ingredientsData) {
      if (ingredientsData.hasOwnProperty(scrapedSlug)) {
        const ingredients = ingredientsData[scrapedSlug];
        let productIdToUpdate = null;

        // Try exact slug match first
        if (slugToProductIdMap.has(scrapedSlug)) {
          productIdToUpdate = slugToProductIdMap.get(scrapedSlug);
        } else {
          // If no exact slug match, try normalized name matching
          const normalizedScrapedName = normalizeString(scrapedSlug.replace(/-/g, ' ').replace(/salsa/g, ''));
          for (const [normalizedDbName, dbProductId] of normalizedNameToProductIdMap.entries()) {
            if (normalizedDbName.includes(normalizedScrapedName) || normalizedScrapedName.includes(normalizedDbName)) {
              productIdToUpdate = dbProductId;
              console.warn(`Warning: Matched scraped slug "${scrapedSlug}" to DB product "${dbProducts.find(p => p.id === productIdToUpdate)?.name}" using normalized name matching.`);
              break;
            }
          }
        }

        if (productIdToUpdate) {
          const updatedProduct = await prisma.product.update({
            where: { id: productIdToUpdate },
            data: { ingredients: ingredients },
          });
          console.log(`Updated product: ${updatedProduct.name} (${updatedProduct.slug}) with ingredients.`);
        } else {
          console.warn(`Warning: No matching product found in DB for scraped slug: "${scrapedSlug}". Skipping update.`);
        }
      }
    }
    console.log('Database update process complete.');
  } catch (error) {
    console.error('Error updating database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
