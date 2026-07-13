const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.josemadridsalsa.com';
const START_PAGE = '/purchase-salsa/';
const LABELS_DIR = path.join(__dirname, '..', 'public', 'images', 'new-products', 'labels');

async function main() {
  // Clear the labels directory
  if (fs.existsSync(LABELS_DIR)) {
    fs.rmSync(LABELS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(LABELS_DIR, { recursive: true });

  let nextUrl = START_PAGE;
  const allImageUrls = new Set();

  while (nextUrl) {
    console.log(`Fetching ${BASE_URL}${nextUrl}`);
    const { data: html } = await axios.get(`${BASE_URL}${nextUrl}`);
    const $ = cheerio.load(html);

    $('.productGrid .product').each((i, element) => {
      const productName = $(element).find('.card-title a').text().trim();
      const productUrl = $(element).find('.card-figure__link').attr('href');
      const srcset = $(element).find('.card-image').attr('data-srcset');

      if (productName && srcset) {
        // Get the highest resolution image from srcset
        const imageUrl = srcset.split(',').pop().trim().split(' ')[0];
        
        if (imageUrl) {
          const imageName = `${productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;
          allImageUrls.add({ url: imageUrl, name: imageName });
        }
      }
    });

    // Find the next page link
    const nextPageLink = $('.pagination-item--next a').attr('href');
    nextUrl = nextPageLink ? new URL(nextPageLink).pathname + new URL(nextPageLink).search : null;
  }
  
  console.log(`Found ${allImageUrls.size} unique images to download.`);

  for (const { url, name } of allImageUrls) {
    try {
      console.log(`Downloading ${url} as ${name}`);
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
      });
      const writer = fs.createWriteStream(path.join(LABELS_DIR, name));
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`Failed to download ${url}: ${error.message}`);
    }
  }

  console.log('Image download complete.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
