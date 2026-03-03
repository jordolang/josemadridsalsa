import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

/**
 * Transform old BigCommerce CSV export to new import format
 * 
 * Old format: id, name, slug, url, price, heat_level, image_url, local_image, full_description
 * New format: name, slug, sku, description, price, heatLevel, categoryName, featuredImage, isActive
 */

const INPUT_FILE = path.join(process.cwd(), 'products.csv');
const OUTPUT_FILE = path.join(process.cwd(), 'products-transformed.csv');

interface OldProduct {
  id: string;
  name: string;
  slug: string;
  url: string;
  price: string;
  heat_level: string;
  image_url: string;
  local_image: string;
  full_description: string;
}

interface NewProduct {
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: string;
  heatLevel: string;
  categoryName: string;
  featuredImage: string;
  isActive: string;
  isFeatured: string;
  inventory: string;
  lowStockThreshold: string;
  weight: string;
}

function transformProduct(old: OldProduct): NewProduct {
  return {
    name: old.name || '',
    slug: old.slug || '',
    sku: `JMS-${old.id}`, // Generate SKU from old ID
    description: old.full_description || '',
    price: old.price || '7',
    heatLevel: old.heat_level?.toUpperCase() || 'MILD',
    categoryName: 'Salsa', // Default category
    featuredImage: old.local_image || old.image_url || '',
    isActive: 'true',
    isFeatured: 'false',
    inventory: '50', // Default inventory
    lowStockThreshold: '10',
    weight: '16', // Default 16 oz jar
  };
}

async function transformCSV() {
  try {
    console.log('Reading old CSV file...');
    const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    
    Papa.parse<OldProduct>(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        console.log(`Found ${results.data.length} products`);
        
        // Transform all products
        const transformedProducts = results.data
          .filter((row) => row.id && row.name) // Skip incomplete rows
          .map(transformProduct);
        
        console.log(`Transformed ${transformedProducts.length} products`);
        
        // Generate new CSV
        const csv = Papa.unparse(transformedProducts, {
          quotes: true,
          header: true,
        });
        
        // Write to output file
        fs.writeFileSync(OUTPUT_FILE, csv);
        
        console.log(`✅ Successfully transformed CSV!`);
        console.log(`Output file: ${OUTPUT_FILE}`);
        console.log(`\nYou can now import this file using the product import feature.`);
        console.log(`\nNote: All products are assigned to "Salsa" category by default.`);
        console.log(`You may want to update the categoryName column for products that belong elsewhere.`);
      },
      error: (error: Error) => {
        console.error('❌ CSV parsing error:', error.message);
        process.exit(1);
      },
    });
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

transformCSV();
