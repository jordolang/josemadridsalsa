import * as fs from 'fs';
import * as path from 'path';
import { parseCSV, validateProducts } from '../lib/product-import';
import { getErrorMessage } from '@/lib/errors';

async function testImport() {
  try {
    console.log('Reading products-transformed.csv...');
    const csvPath = path.join(process.cwd(), 'products-transformed.csv');
    const buffer = fs.readFileSync(csvPath);
    
    console.log('Parsing CSV...');
    const parseResult = await parseCSV(buffer);
    
    if (!parseResult.success) {
      console.error('❌ CSV parsing failed:');
      console.error(parseResult.errors);
      process.exit(1);
    }
    
    console.log(`✅ Parsed ${parseResult.totalRows} rows`);
    console.log('\nFirst row data:');
    console.log(JSON.stringify(parseResult.data![0], null, 2));
    
    // Create a test category map
    const categoryMap = new Map<string, string>();
    categoryMap.set('salsa', 'test-category-id');
    
    console.log('\nValidating products...');
    const validationResult = validateProducts(parseResult.data!, categoryMap);
    
    if (!validationResult.success) {
      console.error('\n❌ Validation failed:');
      console.error(`Total rows: ${validationResult.totalRows}`);
      console.error(`Valid rows: ${validationResult.validRows}`);
      
      if (validationResult.validationErrors) {
        console.error('\nValidation errors:');
        validationResult.validationErrors.slice(0, 5).forEach(err => {
          console.error(`\nRow ${err.row}:`);
          err.errors.forEach(e => console.error(`  - ${e}`));
        });
        
        if (validationResult.validationErrors.length > 5) {
          console.error(`\n... and ${validationResult.validationErrors.length - 5} more errors`);
        }
      }
      process.exit(1);
    }
    
    console.log(`✅ All ${validationResult.validRows} products validated successfully!`);
    console.log('\nFirst validated product:');
    console.log(JSON.stringify(validationResult.data![0], null, 2));
    
  } catch (error: unknown) {
    console.error('❌ Error:', getErrorMessage(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testImport();
