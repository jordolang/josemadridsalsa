#!/usr/bin/env python3
"""
Generate updated seed.ts file with correct product data from scraped data
"""

import json

# Load scraped products
with open('/Users/jordanlang/Repos/josemadridsalsa/scraped-products.json', 'r') as f:
    products = json.load(f)

# Filter out bundle products - only individual jars
individual_products = [p for p in products if not p['name'].startswith('Choose-')]

# Map local image filenames
def get_local_image(name, slug):
    """Map product name to local image filename"""
    mappings = {
        'cherry-hot': 'cherry-hot.jpg',
        'green-apple': 'green-apple.jpg',
        'ghost-of-clovis': 'ghost-of-clovis.png',
        'mango-habanero': 'mango-habanero.png',
        'peach-mild-1': 'peach-mild.png',
        'spanish-verde-x-x-hot': 'spanish-verde-xx-hot.jpg',
        'spanish-verde-mild': 'spanish-verde-mild.png',
        'spanish-verde-hot': 'spanish-verde-hot.jpg',
        'strawberry-mild': 'strawberry-mild.jpg',
        'roasted-pineapple-habanero-hot': 'roasted-pineapple-habanero-hot.jpg',
        'roasted-garlic-olives': 'roasted-garlic-olives.jpg',
        'raspberry-mild': 'raspberry-mild.jpg',
        'raspberry-bbq-chipotle': 'raspberry-bbq-chipotle.jpg',
        'pineapple-mild': 'pineapple-mild.jpg',
        'mango-mild': 'mango-mild.jpg',
        'jamaican-jerk': 'jamaican-jerk.png',
        'garden-fresh-cilantro-salsa-mild': 'garden-cilantro-mild.jpg',
        'original-mild': 'original-mild.jpg',
        'garden-fresh-cilantro-salsa-hot': 'garden-cilantro-hot.jpg',
        'original-x-hot': 'original-x-hot.jpg',
        'clovis-medium-original-medium-chunky': 'clovis-medium.png',
        'chipotle-con-queso': 'chipotle-queso.jpg',
        'chipotle-hot': 'chipotle-hot.png',
        'original-hot': 'original-hot.jpg',
        'cherry-mild': 'cherry-mild.jpg',
        'cherry-chocolate-hot': 'cherry-chocolate-hot.jpg',
        'black-bean-corn-pablano': 'black-bean-corn-poblano.jpg',
    }
    return f"/images/products/{mappings.get(slug, slug + '.jpg')}"

# Simple descriptions based on product names
def generate_description(name):
    """Generate a description for products missing one"""
    descriptions = {
        'Cherry Hot': 'Sweet cherries meet fiery heat in this unique hot salsa with bold flavors.',
        'Green Apple': 'Crisp green apples bring a tart, refreshing twist to this unique fruit salsa.',
        'Ghost of Clovis': 'An otherworldly hot salsa featuring ghost peppers that will haunt your taste buds.',
        'Mango Habanero': 'Sweet tropical mango meets spicy habanero peppers in perfect balance.',
        'Peach Mild': 'Sweet, juicy peaches create a delightfully fruity and mild salsa.',
        'Spanish Verde X X Hot': 'A double-extra-hot green salsa made with tomatillos and the hottest peppers.',
        'Spanish Verde Mild': 'A mild green salsa with fresh tomatillos and herbs.',
        'Spanish Verde Hot': 'A fiery green salsa with tomatillos and hot peppers for serious heat lovers.',
        'Strawberry Mild': 'Fresh strawberries bring unexpected sweetness to this unique mild salsa.',
        'Roasted Pineapple Habanero Hot': 'Roasted tropical pineapple balances intense habanero heat.',
        'Roasted Garlic & Olives': 'Mediterranean-inspired salsa with roasted garlic and briny olives.',
        'Raspberry Mild': 'Tart raspberries create a sophisticated, mildly sweet salsa.',
        'Raspberry BBQ Chipotle': 'Raspberries meet smoky chipotle and BBQ spices - perfect for grilling.',
        'Pineapple Mild': 'Tropical pineapple brings bright, sweet flavors to this refreshing mild salsa.',
        'Mango Mild': 'Ripe mangos blend beautifully with mild spices for a tropical twist.',
        'Jamaican Jerk': 'Caribbean spices and scotch bonnet peppers create authentic Jamaican jerk flavors.',
        'Garden Fresh Cilantro Salsa Mild': 'Fresh cilantro takes center stage in this bright, herbaceous mild salsa.',
        'Original Mild': 'Our signature mild salsa made with fresh tomatoes, onions, and perfect spices.',
        'Garden Fresh Cilantro Salsa Hot': 'Fresh cilantro meets fiery peppers in this bright, spicy salsa.',
        'Original X Hot': 'Our hottest salsa yet! Fire-roasted peppers create intense heat and incredible flavor.',
        'Clovis Medium (Original Medium Chunky)': 'Our most popular salsa! Perfect balance of flavor and heat.',
        'Chipotle Con Queso': 'Creamy cheese dip with smoky chipotle peppers - perfect for chips.',
        'Chipotle Hot': 'Smoky chipotle peppers deliver intense heat and deep, complex flavors.',
        'Original Hot': 'For heat lovers! This bold salsa packs serious flavor with a kick that builds.',
        'Cherry Mild': 'Sweet cherries create a delightfully fruity and mild salsa.',
        'Cherry Chocolate Hot': 'Dark cherries and rich chocolate meet scorching heat in this gourmet salsa.',
        'Black Bean Corn Pablano': 'A hearty salsa with black beans, sweet corn, and roasted poblano peppers.',
    }
    return descriptions.get(name, f"Delicious {name} salsa made with premium ingredients.")

# Organize by heat level and category
by_heat = {
    'MILD': [],
    'MEDIUM': [],
    'HOT': [],
    'EXTRA_HOT': [],
    'FRUIT': []
}

for p in individual_products:
    p['local_image'] = get_local_image(p['name'], p['slug'])
    p['full_description'] = p['description'] if p['description'] else generate_description(p['name'])
    
    heat = p['heat_level']
    if heat in by_heat:
        by_heat[heat].append(p)

# Print summary
print("=" * 70)
print("PRODUCT DATA SUMMARY")
print("=" * 70)
print(f"\nTotal individual products: {len(individual_products)}")
print(f"All priced at $7.00 each")
print("\nBreakdown by heat level:")
for heat, items in by_heat.items():
    if items:
        print(f"\n  {heat}: {len(items)} products")
        for item in items:
            print(f"    • {item['name']}")
            print(f"      Image: {item['local_image']}")
            print(f"      Slug: {item['slug']}")

# Save organized data
output_file = '/Users/jordanlang/Repos/josemadridsalsa/organized-products.json'
with open(output_file, 'w') as f:
    json.dump({
        'by_heat_level': by_heat,
        'all_products': individual_products
    }, f, indent=2)

print(f"\n✅ Organized data saved to: {output_file}")
print("=" * 70)
