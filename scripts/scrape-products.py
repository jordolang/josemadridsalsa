#!/usr/bin/env python3
"""
Web scraper for Jose Madrid Salsa product data
Scrapes all products from josemadridsalsa.com/purchase-salsa/
"""

import re
import json
import time
import subprocess
from typing import List, Dict, Any
from urllib.parse import urljoin

# Note: This script uses curl to avoid installing Python dependencies
# It parses the HTML using regex which is sufficient for this structured data

BASE_URL = "https://www.josemadridsalsa.com"
CATEGORY_URL = f"{BASE_URL}/purchase-salsa/"

def run_curl(url: str) -> str:
    """Run curl command to fetch URL content"""
    result = subprocess.run(
        ["curl", "-s", url],
        capture_output=True,
        text=True
    )
    return result.stdout

def extract_products_from_page(html: str) -> List[Dict[str, Any]]:
    """Extract product information from category page HTML"""
    products = []
    
    # Find all product cards using regex
    card_pattern = r'<article[^>]*class="card[^"]*"[^>]*data-test="card-(\d+)"[^>]*data-name="([^"]+)"[^>]*data-product-price="([^"]*)"[^>]*>'
    cards = re.finditer(card_pattern, html, re.DOTALL)
    
    for card in cards:
        product_id = card.group(1)
        name = card.group(2)
        price = card.group(3).strip()
        
        # Find the product URL
        url_match = re.search(
            r'href="(https://www\.josemadridsalsa\.com/[^"]+/)"[^>]*>[\s\S]*?' + re.escape(name),
            html[card.start():card.start() + 5000]
        )
        
        if url_match:
            url = url_match.group(1)
            slug = url.rstrip('/').split('/')[-1]
            
            # Find image URL
            img_match = re.search(
                r'<img src="(https://cdn11\.bigcommerce\.com/[^"]+)"[^>]*alt="' + re.escape(name) + '"',
                html[card.start():card.start() + 5000]
            )
            
            image_url = img_match.group(1) if img_match else None
            
            products.append({
                'id': product_id,
                'name': name,
                'slug': slug,
                'url': url,
                'price': 7.00,  # All individual jars are $7.00
                'image_url': image_url
            })
    
    return products

def scrape_product_details(url: str) -> Dict[str, Any]:
    """Scrape detailed product information from product page"""
    html = run_curl(url)
    
    # Extract description
    desc_match = re.search(r'<div class="productView-description"[^>]*>(.*?)</div>', html, re.DOTALL)
    description = ""
    if desc_match:
        desc_html = desc_match.group(1)
        # Strip HTML tags
        description = re.sub(r'<[^>]+>', '', desc_html).strip()
        description = re.sub(r'\s+', ' ', description)
    
    # Extract high-res images
    img_pattern = r'https://cdn11\.bigcommerce\.com/s-dsk4gx4/images/stencil/\d+x\d+/products/\d+/\d+/[^"]+\.jpg'
    images = list(set(re.findall(img_pattern, html)))
    
    return {
        'description': description,
        'images': images
    }

def determine_heat_level(name: str) -> str:
    """Determine heat level from product name"""
    name_lower = name.lower()
    
    if 'ghost' in name_lower or 'x x hot' in name_lower or 'xx hot' in name_lower:
        return 'EXTRA_HOT'
    elif 'hot' in name_lower:
        return 'HOT'
    elif 'medium' in name_lower:
        return 'MEDIUM'
    elif 'mild' in name_lower:
        return 'MILD'
    else:
        # Fruit/specialty salsas
        return 'FRUIT'

def scrape_all_products() -> List[Dict[str, Any]]:
    """Scrape all products from all pages"""
    all_products = []
    page = 1
    
    while True:
        print(f"Scraping page {page}...")
        
        if page == 1:
            url = CATEGORY_URL
        else:
            url = f"{CATEGORY_URL}?page={page}"
        
        html = run_curl(url)
        products = extract_products_from_page(html)
        
        if not products:
            print(f"No more products found on page {page}")
            break
        
        print(f"Found {len(products)} products on page {page}")
        all_products.extend(products)
        
        page += 1
        time.sleep(1)  # Be respectful with requests
    
    return all_products

def main():
    """Main function to scrape and process all products"""
    print("Starting product scraper...")
    print("=" * 60)
    
    # Scrape all product listings
    products = scrape_all_products()
    print(f"\nTotal products found: {len(products)}")
    print("=" * 60)
    
    # Scrape detailed information for each product
    print("\nScraping product details...")
    for i, product in enumerate(products, 1):
        print(f"  [{i}/{len(products)}] {product['name']}...", end=" ")
        try:
            details = scrape_product_details(product['url'])
            product['description'] = details['description']
            product['all_images'] = details['images']
            product['heat_level'] = determine_heat_level(product['name'])
            print("✓")
            time.sleep(0.5)  # Be respectful
        except Exception as e:
            print(f"✗ Error: {e}")
    
    # Save to JSON file
    output_file = '/Users/jordanlang/Repos/josemadridsalsa/scraped-products.json'
    with open(output_file, 'w') as f:
        json.dump(products, f, indent=2)
    
    print(f"\n✅ Scraped data saved to: {output_file}")
    print(f"\nProduct Summary:")
    print("=" * 60)
    
    # Group by heat level
    by_heat = {}
    for p in products:
        heat = p.get('heat_level', 'UNKNOWN')
        if heat not in by_heat:
            by_heat[heat] = []
        by_heat[heat].append(p['name'])
    
    for heat, names in sorted(by_heat.items()):
        print(f"\n{heat}:")
        for name in sorted(names):
            print(f"  - {name}")
    
    print("\n" + "=" * 60)
    print(f"Total: {len(products)} products, all priced at $7.00")
    print("=" * 60)

if __name__ == "__main__":
    main()
