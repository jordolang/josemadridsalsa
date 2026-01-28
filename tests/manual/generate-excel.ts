/**
 * Script to generate sample products Excel file for testing
 * Run with: npx tsx tests/manual/generate-excel.ts
 */

import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

async function generateSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');

  // Define columns with headers
  worksheet.columns = [
    { header: 'name', key: 'name', width: 30 },
    { header: 'slug', key: 'slug', width: 30 },
    { header: 'sku', key: 'sku', width: 15 },
    { header: 'description', key: 'description', width: 50 },
    { header: 'price', key: 'price', width: 10 },
    { header: 'compareAtPrice', key: 'compareAtPrice', width: 15 },
    { header: 'costPrice', key: 'costPrice', width: 12 },
    { header: 'inventory', key: 'inventory', width: 10 },
    { header: 'lowStockThreshold', key: 'lowStockThreshold', width: 18 },
    { header: 'heatLevel', key: 'heatLevel', width: 15 },
    { header: 'ingredients', key: 'ingredients', width: 50 },
    { header: 'categoryName', key: 'categoryName', width: 20 },
    { header: 'barcode', key: 'barcode', width: 15 },
    { header: 'weight', key: 'weight', width: 10 },
    { header: 'featuredImage', key: 'featuredImage', width: 40 },
    { header: 'images', key: 'images', width: 50 },
    { header: 'isActive', key: 'isActive', width: 10 },
    { header: 'isFeatured', key: 'isFeatured', width: 12 },
    { header: 'sortOrder', key: 'sortOrder', width: 12 },
    { header: 'metaTitle', key: 'metaTitle', width: 40 },
    { header: 'metaDescription', key: 'metaDescription', width: 50 },
    { header: 'ogImage', key: 'ogImage', width: 40 },
    { header: 'searchKeywords', key: 'searchKeywords', width: 40 },
  ];

  // Add sample products
  const products = [
    {
      name: 'Smoky Chipotle Sauce',
      slug: 'smoky-chipotle-sauce',
      sku: 'CHP-001',
      description: 'Deep smoky flavor with chipotle peppers',
      price: 11.99,
      compareAtPrice: 14.99,
      costPrice: 7.25,
      inventory: 110,
      lowStockThreshold: 12,
      heatLevel: 'MEDIUM',
      ingredients: 'Chipotle peppers, tomatoes, onions, garlic, spices',
      categoryName: 'Sauces',
      barcode: '123456789011',
      weight: 9.5,
      featuredImage: '/images/products/smoky-chipotle.jpg',
      images: '/images/products/chipotle-1.jpg,/images/products/chipotle-2.jpg',
      isActive: 'true',
      isFeatured: 'false',
      sortOrder: 11,
      metaTitle: 'Smoky Chipotle Sauce - Deep Smoky Flavor',
      metaDescription: 'Authentic chipotle sauce with a deep smoky flavor',
      ogImage: '/images/og/chipotle.jpg',
      searchKeywords: 'chipotle, smoky, medium, mexican',
    },
    {
      name: 'Carolina Reaper Inferno',
      slug: 'carolina-reaper-inferno',
      sku: 'REP-001',
      description: 'The hottest sauce in our collection',
      price: 24.99,
      compareAtPrice: 29.99,
      costPrice: 14.50,
      inventory: 40,
      lowStockThreshold: 5,
      heatLevel: 'EXTRA_HOT',
      ingredients: 'Carolina Reaper peppers, vinegar, salt',
      categoryName: 'Sauces',
      barcode: '123456789012',
      weight: 8.0,
      featuredImage: '/images/products/reaper-inferno.jpg',
      images: '/images/products/reaper-1.jpg,/images/products/reaper-2.jpg,/images/products/reaper-3.jpg',
      isActive: 'yes',
      isFeatured: 'yes',
      sortOrder: 12,
      metaTitle: 'Carolina Reaper Inferno - Extreme Heat',
      metaDescription: 'Our hottest sauce made with Carolina Reaper peppers',
      ogImage: '/images/og/reaper.jpg',
      searchKeywords: 'carolina reaper, extreme hot, hottest, challenge',
    },
    {
      name: 'Sweet Peach Habanero',
      slug: 'sweet-peach-habanero',
      sku: 'PCH-001',
      description: 'Georgia peaches meet habanero peppers',
      price: 15.99,
      compareAtPrice: null,
      costPrice: 9.50,
      inventory: 70,
      lowStockThreshold: 10,
      heatLevel: 'FRUIT',
      ingredients: 'Peaches, habanero peppers, honey, cider vinegar',
      categoryName: 'Sauces',
      barcode: '123456789013',
      weight: 11.0,
      featuredImage: '/images/products/peach-habanero.jpg',
      images: '',
      isActive: '1',
      isFeatured: '0',
      sortOrder: 13,
      metaTitle: 'Sweet Peach Habanero - Fruity Heat',
      metaDescription: 'Sweet Georgia peaches with spicy habanero peppers',
      ogImage: null,
      searchKeywords: 'peach, habanero, fruit, sweet, spicy',
    },
    {
      name: 'Verde Picante',
      slug: 'verde-picante',
      sku: 'VRD-001',
      description: 'Traditional Mexican green hot sauce',
      price: 9.99,
      compareAtPrice: 11.99,
      costPrice: 5.75,
      inventory: 130,
      lowStockThreshold: 15,
      heatLevel: 'HOT',
      ingredients: 'Green chiles, tomatillos, jalapeños, lime, cilantro',
      categoryName: 'Sauces',
      barcode: '123456789014',
      weight: 10.0,
      featuredImage: '/images/products/verde-picante.jpg',
      images: null,
      isActive: 'true',
      isFeatured: 'false',
      sortOrder: 14,
      metaTitle: null,
      metaDescription: null,
      ogImage: null,
      searchKeywords: 'verde, green sauce, hot, mexican, tomatillo',
    },
    {
      name: 'Test Missing Name',
      slug: 'test-missing-name',
      sku: 'INV-003',
      description: 'This row is missing the name field',
      price: 9.99,
      inventory: 50,
      heatLevel: 'MEDIUM',
      categoryName: 'Sauces',
      isActive: 'true',
      isFeatured: 'false',
    },
    {
      name: 'Duplicate SKU Excel',
      slug: 'duplicate-sku-excel',
      sku: 'CHP-001',
      description: 'This has the same SKU as Smoky Chipotle Sauce',
      price: 9.99,
      inventory: 50,
      heatLevel: 'MEDIUM',
      categoryName: 'Sauces',
      isActive: 'true',
      isFeatured: 'false',
      sortOrder: 99,
    },
  ];

  // Add rows
  products.forEach((product) => {
    worksheet.addRow(product);
  });

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Save the file
  const outputPath = join(process.cwd(), 'tests', 'manual', 'sample-products.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Excel file generated: ${outputPath}`);
}

// Run the script
generateSampleExcel().catch(console.error);
