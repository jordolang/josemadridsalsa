const fs = require('fs');

// Read the JSON file
const data = JSON.parse(fs.readFileSync('organized-products.json', 'utf8'));

// Get all products from the all_products array
const products = data.all_products;

console.log(`Found ${products.length} products in total`);

// Define CSV headers
const headers = ['id', 'name', 'slug', 'url', 'price', 'heat_level', 'image_url', 'local_image', 'full_description'];

// Create CSV content
let csv = headers.join(',') + '\n';

// Add product rows
products.forEach(product => {
  const row = [
    product.id || '',
    `"${(product.name || '').replace(/"/g, '""')}"`,
    product.slug || '',
    product.url || '',
    product.price || '',
    product.heat_level || '',
    product.image_url || '',
    product.local_image || '',
    `"${(product.full_description || '').replace(/"/g, '""')}"`
  ];
  csv += row.join(',') + '\n';
});

// Write to CSV file
fs.writeFileSync('products.csv', csv);

console.log(`Successfully created products.csv with ${products.length} products`);
