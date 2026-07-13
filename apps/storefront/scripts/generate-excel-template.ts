import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');

  // Define columns with headers
  worksheet.columns = [
    { header: 'name', key: 'name', width: 30 },
    { header: 'slug', key: 'slug', width: 25 },
    { header: 'sku', key: 'sku', width: 15 },
    { header: 'description', key: 'description', width: 50 },
    { header: 'price', key: 'price', width: 12 },
    { header: 'compareAtPrice', key: 'compareAtPrice', width: 15 },
    { header: 'costPrice', key: 'costPrice', width: 12 },
    { header: 'inventory', key: 'inventory', width: 12 },
    { header: 'lowStockThreshold', key: 'lowStockThreshold', width: 18 },
    { header: 'heatLevel', key: 'heatLevel', width: 15 },
    { header: 'ingredients', key: 'ingredients', width: 50 },
    { header: 'categoryId', key: 'categoryId', width: 15 },
    { header: 'categoryName', key: 'categoryName', width: 20 },
    { header: 'barcode', key: 'barcode', width: 15 },
    { header: 'weight', key: 'weight', width: 12 },
    { header: 'featuredImage', key: 'featuredImage', width: 40 },
    { header: 'images', key: 'images', width: 60 },
    { header: 'isActive', key: 'isActive', width: 12 },
    { header: 'isFeatured', key: 'isFeatured', width: 12 },
    { header: 'sortOrder', key: 'sortOrder', width: 12 },
    { header: 'metaTitle', key: 'metaTitle', width: 50 },
    { header: 'metaDescription', key: 'metaDescription', width: 60 },
    { header: 'ogImage', key: 'ogImage', width: 40 },
    { header: 'searchKeywords', key: 'searchKeywords', width: 50 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0066CC' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 20;

  // Add example data rows
  const exampleProducts = [
    {
      name: "Jose's Classic Hot Sauce",
      slug: 'joses-classic-hot-sauce',
      sku: 'JOS-001',
      description: 'Our signature hot sauce with a perfect balance of heat and flavor. Made with fresh habaneros and a secret blend of spices.',
      price: 12.99,
      compareAtPrice: 15.99,
      costPrice: 6.50,
      inventory: 150,
      lowStockThreshold: 10,
      heatLevel: 'MEDIUM',
      ingredients: 'Habanero Peppers, Vinegar, Garlic, Salt, Spices',
      categoryId: '',
      categoryName: 'Hot Sauces',
      barcode: '123456789012',
      weight: 8.5,
      featuredImage: '/images/products/classic-hot-sauce.jpg',
      images: '/images/products/classic-1.jpg,/images/products/classic-2.jpg',
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
      metaTitle: "Jose's Classic Hot Sauce - Authentic Habanero Heat",
      metaDescription: "Experience the perfect blend of heat and flavor with Jose's signature classic hot sauce.",
      ogImage: '/images/og/classic-hot-sauce.jpg',
      searchKeywords: "hot sauce, habanero, spicy, classic, jose's",
    },
    {
      name: 'Smoky Chipotle Salsa',
      slug: 'smoky-chipotle-salsa',
      sku: 'JOS-002',
      description: 'Rich and smoky chipotle salsa perfect for tacos, chips, or grilling. Medium heat with deep smoky flavor.',
      price: 10.99,
      compareAtPrice: 12.99,
      costPrice: 5.25,
      inventory: 200,
      lowStockThreshold: 15,
      heatLevel: 'MEDIUM',
      ingredients: 'Chipotle Peppers, Tomatoes, Onions, Lime Juice, Cilantro, Salt',
      categoryId: '',
      categoryName: 'Salsas',
      barcode: '123456789013',
      weight: 10.0,
      featuredImage: '/images/products/chipotle-salsa.jpg',
      images: '/images/products/chipotle-1.jpg,/images/products/chipotle-2.jpg',
      isActive: true,
      isFeatured: false,
      sortOrder: 2,
      metaTitle: 'Smoky Chipotle Salsa - Rich & Flavorful',
      metaDescription: 'Authentic smoky chipotle salsa made with fire-roasted peppers and fresh ingredients.',
      ogImage: '/images/og/chipotle-salsa.jpg',
      searchKeywords: 'salsa, chipotle, smoky, medium heat, mexican',
    },
    {
      name: 'Mango Habanero Fusion',
      slug: 'mango-habanero-fusion',
      sku: 'JOS-003',
      description: 'Sweet and spicy fusion of ripe mangos and fiery habaneros. Perfect for seafood and grilled chicken.',
      price: 14.99,
      compareAtPrice: null,
      costPrice: 7.00,
      inventory: 75,
      lowStockThreshold: 5,
      heatLevel: 'HOT',
      ingredients: 'Mango, Habanero Peppers, Honey, Lime Juice, Ginger, Sea Salt',
      categoryId: '',
      categoryName: 'Specialty Sauces',
      barcode: '123456789014',
      weight: 9.0,
      featuredImage: '/images/products/mango-habanero.jpg',
      images: '/images/products/mango-habanero-1.jpg',
      isActive: true,
      isFeatured: true,
      sortOrder: 3,
      metaTitle: 'Mango Habanero Hot Sauce - Sweet Heat Perfection',
      metaDescription: 'Tropical mango meets fiery habanero in this award-winning fusion sauce.',
      ogImage: '/images/og/mango-habanero.jpg',
      searchKeywords: 'mango, habanero, sweet, spicy, fusion, tropical',
    },
  ];

  exampleProducts.forEach((product) => {
    worksheet.addRow(product);
  });

  // Add instructions/notes in a separate sheet
  const notesSheet = workbook.addWorksheet('Instructions');
  notesSheet.columns = [
    { header: 'Field Name', key: 'field', width: 25 },
    { header: 'Required', key: 'required', width: 12 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Description', key: 'description', width: 80 },
  ];

  // Style notes header
  const notesHeader = notesSheet.getRow(1);
  notesHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  notesHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0066CC' },
  };
  notesHeader.height = 20;

  const fieldInfo = [
    { field: 'name', required: 'Yes', type: 'Text', description: 'Product name (must be unique)' },
    { field: 'slug', required: 'Yes', type: 'Text', description: 'URL-friendly slug (e.g., "joses-hot-sauce")' },
    { field: 'sku', required: 'Yes', type: 'Text', description: 'Stock keeping unit (must be unique)' },
    { field: 'price', required: 'Yes', type: 'Number', description: 'Product price (must be positive)' },
    { field: 'heatLevel', required: 'Yes', type: 'Enum', description: 'Heat level: MILD, MEDIUM, HOT, EXTRA_HOT, or FRUIT' },
    { field: 'categoryId', required: 'No*', type: 'Text', description: 'Category ID (*required if categoryName not provided)' },
    { field: 'categoryName', required: 'No*', type: 'Text', description: 'Category name (*required if categoryId not provided)' },
    { field: 'description', required: 'No', type: 'Text', description: 'Product description (supports markdown)' },
    { field: 'compareAtPrice', required: 'No', type: 'Number', description: 'Original price for showing discounts' },
    { field: 'costPrice', required: 'No', type: 'Number', description: 'Cost price for profit calculations' },
    { field: 'inventory', required: 'No', type: 'Number', description: 'Stock quantity (default: 0)' },
    { field: 'lowStockThreshold', required: 'No', type: 'Number', description: 'Alert when stock below this (default: 5)' },
    { field: 'ingredients', required: 'No', type: 'Text', description: 'Comma-separated list of ingredients' },
    { field: 'barcode', required: 'No', type: 'Text', description: 'Product barcode/UPC' },
    { field: 'weight', required: 'No', type: 'Number', description: 'Product weight in ounces' },
    { field: 'featuredImage', required: 'No', type: 'Text', description: 'URL or path to main product image' },
    { field: 'images', required: 'No', type: 'Text', description: 'Comma-separated URLs/paths for additional images' },
    { field: 'isActive', required: 'No', type: 'Boolean', description: 'Active status (true/false, yes/no, 1/0, default: true)' },
    { field: 'isFeatured', required: 'No', type: 'Boolean', description: 'Featured status (true/false, yes/no, 1/0, default: false)' },
    { field: 'sortOrder', required: 'No', type: 'Number', description: 'Sort order for display (default: 0)' },
    { field: 'metaTitle', required: 'No', type: 'Text', description: 'SEO meta title' },
    { field: 'metaDescription', required: 'No', type: 'Text', description: 'SEO meta description' },
    { field: 'ogImage', required: 'No', type: 'Text', description: 'Open Graph image URL/path for social sharing' },
    { field: 'searchKeywords', required: 'No', type: 'Text', description: 'Comma-separated keywords for search' },
  ];

  fieldInfo.forEach((info) => {
    notesSheet.addRow(info);
  });

  // Add general notes
  notesSheet.addRow({});
  notesSheet.addRow({ field: 'IMPORTANT NOTES:', required: '', type: '', description: '' });
  notesSheet.addRow({ field: '', required: '', type: '', description: '1. Required fields: name, slug, sku, price, heatLevel, and either categoryId OR categoryName' });
  notesSheet.addRow({ field: '', required: '', type: '', description: '2. Heat levels must be one of: MILD, MEDIUM, HOT, EXTRA_HOT, FRUIT' });
  notesSheet.addRow({ field: '', required: '', type: '', description: '3. Boolean fields accept: true/false, yes/no, 1/0' });
  notesSheet.addRow({ field: '', required: '', type: '', description: '4. Comma-separated fields: ingredients, images, searchKeywords' });
  notesSheet.addRow({ field: '', required: '', type: '', description: '5. Leave optional fields empty if not needed' });
  notesSheet.addRow({ field: '', required: '', type: '', description: '6. The Products sheet contains 3 example products - replace with your data' });

  // Save the file
  const outputPath = path.resolve(__dirname, '../public/templates/products-template.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Excel template created: ${outputPath}`);
}

generateExcelTemplate().catch(console.error);
