/**
 * Seed script: Populates NutritionalInfo, Ingredient, and ProductIngredient tables
 * for all Jose Madrid Salsa products.
 *
 * Data sourced from OCR scans of physical product labels (scripts/ingredients-text/*.txt)
 *
 * Run: npx tsx scripts/seed-nutrition-ingredients.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Nutrition data per product slug ────────────────────────────────────────
// Values extracted from OCR'd product labels. All products are 13 oz (369g).
// Serving Size: 2 Tbsp (30ml), 13 servings per container
interface NutritionEntry {
  servingSize: string
  servingsPerContainer: number
  calories: number
  caloriesFromFat: number
  totalFatG: number
  totalFatDV: number
  saturatedFatG: number
  saturatedFatDV: number
  transFatG: number
  cholesterolMg: number
  cholesterolDV: number
  sodiumMg: number
  sodiumDV: number
  totalCarbG: number
  totalCarbDV: number
  dietaryFiberG: number
  dietaryFiberDV: number
  sugarsG: number
  proteinG: number
  vitaminADV: number
  vitaminCDV: number
  calciumDV: number
  ironDV: number
  allergens?: string
}

// Base nutrition profile shared by most red salsas
const redSalsaBase: NutritionEntry = {
  servingSize: '2 Tbsp (30ml)',
  servingsPerContainer: 13,
  calories: 10,
  caloriesFromFat: 0,
  totalFatG: 0,
  totalFatDV: 0,
  saturatedFatG: 0,
  saturatedFatDV: 0,
  transFatG: 0,
  cholesterolMg: 0,
  cholesterolDV: 0,
  sodiumMg: 64,
  sodiumDV: 3,
  totalCarbG: 2,
  totalCarbDV: 1,
  dietaryFiberG: 1,
  dietaryFiberDV: 4,
  sugarsG: 0,
  proteinG: 0,
  vitaminADV: 4,
  vitaminCDV: 1,
  calciumDV: 1,
  ironDV: 2,
}

// Fruit salsa base (slightly more sugar from fruit)
const fruitSalsaBase: NutritionEntry = {
  ...redSalsaBase,
  sugarsG: 2,
}

// Verde salsa base (higher sodium from tomatillo base)
const verdeSalsaBase: NutritionEntry = {
  ...redSalsaBase,
  calories: 5,
  sodiumMg: 120,
  sodiumDV: 5,
  sugarsG: 0,
}

const nutritionData: Record<string, NutritionEntry> = {
  // ─── Original / Clovis line ─────────────────────
  'jose-madrid-original-mild': { ...redSalsaBase },
  'clovis-medium-salsa': { ...redSalsaBase },
  'original-hot': { ...redSalsaBase },
  'original-x-hot': { ...redSalsaBase },
  'ghost-of-clovis': { ...redSalsaBase, calories: 5 },
  'ghost-of-clovis-hot': { ...redSalsaBase, calories: 5 },

  // ─── Black Bean Corn Poblano ─────────────────────
  'black-bean-corn-poblano': {
    ...redSalsaBase,
    sodiumMg: 85,
    sodiumDV: 4,
  },

  // ─── Chipotle line ──────────────────────────────
  'chipotle-hot-salsa': { ...redSalsaBase },
  'chipotle-con-queso-salsa': {
    ...redSalsaBase,
    totalFatG: 1,
    totalFatDV: 1,
    sodiumMg: 50,
    sodiumDV: 2,
    vitaminADV: 6,
    vitaminCDV: 7,
    allergens: 'Contains: Milk, Wheat',
  },

  // ─── Garden Fresh Cilantro ──────────────────────
  'garden-cilantro-mild-salsa': {
    ...redSalsaBase,
    sodiumMg: 96,
    sodiumDV: 4,
    sugarsG: 2,
  },
  'garden-cilantro-hot-salsa': {
    ...redSalsaBase,
    sodiumMg: 96,
    sodiumDV: 4,
  },

  // ─── Jamaican Jerk ──────────────────────────────
  'jamaican-jerk-salsa': { ...redSalsaBase },

  // ─── Fruit salsas ──────────────────────────────
  'cherry-mild-salsa': { ...fruitSalsaBase },
  'cherry-hot': { ...fruitSalsaBase },
  'cherry-chocolate-hot': {
    ...fruitSalsaBase,
    sugarsG: 3,
  },
  'mango-mild-salsa': { ...fruitSalsaBase },
  'mango-habanero-salsa': { ...fruitSalsaBase },
  'peach-mild-salsa': { ...fruitSalsaBase },
  'pineapple-mild-salsa': { ...fruitSalsaBase },
  'raspberry-mild-salsa': { ...fruitSalsaBase },
  'raspberry-bbq-chipotle': { ...fruitSalsaBase },
  'roasted-pineapple-habanero-hot': { ...fruitSalsaBase },
  'strawberry-mild': { ...fruitSalsaBase },
  'green-apple': { ...fruitSalsaBase },

  // ─── Roasted Garlic & Olives ────────────────────
  'roasted-garlic-olives': { ...redSalsaBase },

  // ─── Spanish Verde line ─────────────────────────
  'spanish-verde-mild': { ...verdeSalsaBase },
  'spanish-verde-hot': { ...verdeSalsaBase },
  'spanish-verde-xx-hot': { ...verdeSalsaBase },
}

// ─── Ingredient data per product slug ───────────────────────────────────────
// Each entry is an array of { name, qualifier? } in label order.
// "qualifier" holds sub-ingredients shown in parentheses on the label.
interface IngredientEntry {
  name: string
  qualifier?: string // sub-ingredients in parentheses, e.g. "Tomatoes, Citric Acid, Calcium Chloride"
}

const ingredientData: Record<string, IngredientEntry[]> = {
  'jose-madrid-original-mild': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Water' },
    { name: 'Garlic' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Spices' },
  ],

  'clovis-medium-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Water' },
    { name: 'Garlic' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Spices' },
  ],

  'original-hot': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Water' },
    { name: 'Garlic' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Spices' },
  ],

  'original-x-hot': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Water' },
    { name: 'Arbol Chiles' },
    { name: 'Habanero Chiles' },
    { name: 'Garlic' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Spices' },
  ],

  'black-bean-corn-poblano': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Black Beans', qualifier: 'Black Beans, Water, Salt, Calcium Chloride, Ferrous Gluconate' },
    { name: 'Corn', qualifier: 'Corn, Water, Sugar, Salt' },
    { name: 'Onions' },
    { name: 'Poblano Peppers' },
    { name: 'Cumin' },
    { name: 'Basil' },
    { name: 'Spices' },
    { name: 'Salt' },
    { name: 'Citric Acid' },
  ],

  'cherry-chocolate-hot': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Michigan Cherries' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Natural Cherry Flavor' },
    { name: 'Dark Chocolate' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'cherry-hot': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Michigan Cherries' },
    { name: 'Green Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Natural Cherry Flavor' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Habanero' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'cherry-mild-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Michigan Cherries' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Natural Cherry Flavor' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'chipotle-con-queso-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Tomato Juice, Salt, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    {
      name: 'Chipotle Peppers',
      qualifier: 'Chipotle Peppers, Water, Tomato Puree, Vinegar, Salt, Sugar, Garlic, Vegetable Oil',
    },
    {
      name: 'Cheddar Cheese Sauce',
      qualifier:
        'Oil, Water, Corn Starch-Modified, Cheddar Cheese (Cultured Milk, Salt, Enzymes, Annatto Color), Whey, Vegetable Oil, Vinegar, Salt, Sodium Phosphate, Nonfat Dry Milk, Natural Flavors',
    },
    { name: 'Roasted Red Peppers', qualifier: 'Red Peppers, Water, Citric Acid, Salt' },
    { name: 'Onions' },
    { name: 'Natural Hickory Smoke Flavoring', qualifier: 'Water, Hickory Smoke Concentrate' },
    { name: 'Spices' },
    { name: 'Salt' },
    { name: 'Citric Acid' },
  ],

  'chipotle-hot-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Roasted Red Peppers', qualifier: 'Red Peppers, Water, Citric Acid, Salt' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Natural Hickory Smoke Flavoring' },
    { name: 'Garlic' },
    { name: 'Honey' },
    { name: 'Salt' },
  ],

  'garden-cilantro-mild-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cilantro' },
    { name: 'Jalapeno Peppers' },
    { name: 'Lemon Juice', qualifier: 'From Concentrate' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Garlic' },
    { name: 'Salt' },
    { name: 'Spices' },
  ],

  'garden-cilantro-hot-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cilantro' },
    { name: 'Jalapeno Peppers' },
    { name: 'Lemon Juice', qualifier: 'From Concentrate' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Garlic' },
    { name: 'Salt' },
    { name: 'Spices' },
  ],

  'ghost-of-clovis': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Water' },
    { name: 'Garlic' },
    { name: 'Ghost Pepper' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Spices' },
  ],

  'ghost-of-clovis-hot': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Water' },
    { name: 'Garlic' },
    { name: 'Ghost Pepper' },
    { name: 'Habanero Peppers' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Spices' },
  ],

  'jamaican-jerk-salsa': [
    { name: 'Carrots' },
    { name: 'Water' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Onions' },
    { name: 'Habanero Peppers' },
    { name: 'Cider Vinegar' },
    { name: 'White Vinegar' },
    { name: 'All Spice' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Agave' },
    { name: 'Ginger' },
    { name: 'Turmeric' },
    { name: 'Cinnamon' },
    { name: 'Salt' },
  ],

  'mango-mild-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Mango' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Mango Natural Flavoring' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'mango-habanero-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Mango' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Mango Natural Flavoring' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Habanero Pepper' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'peach-mild-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Peaches' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Natural Peach Flavor' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'pineapple-mild-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Pineapples' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Pineapple Natural Flavoring' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'raspberry-mild-salsa': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Raspberries' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Raspberry Natural Flavoring' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'raspberry-bbq-chipotle': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Raspberries' },
    { name: 'Chipotle Peppers', qualifier: 'Chipotle Peppers, Water, Tomato Puree, Vinegar, Salt, Sugar, Garlic, Vegetable Oil' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Sugar' },
    { name: 'Natural Hickory Smoke Flavoring' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Salt' },
  ],

  'roasted-garlic-olives': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Green Olives' },
    { name: 'Black Olives', qualifier: 'Black Olives, Water, Salt, Ferrous Gluconate' },
    { name: 'Fine Diced Garlic Roasted', qualifier: 'Garlic, Water, Distilled Vinegar, Citric Acid' },
    { name: 'Onions' },
    { name: 'Garlic Concentrate' },
    { name: 'Cider Vinegar' },
    { name: 'Honey' },
  ],

  'roasted-pineapple-habanero-hot': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Pineapples' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Roasted Habanero Chili' },
    { name: 'Pineapple Natural Flavoring' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'strawberry-mild': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Strawberries' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Strawberry Natural Flavoring' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  'green-apple': [
    { name: 'Diced Tomatoes', qualifier: 'Tomatoes, Citric Acid, Calcium Chloride' },
    { name: 'Crushed Tomatoes', qualifier: 'Tomatoes, Citric Acid' },
    { name: 'Green Apples' },
    { name: 'Chilies', qualifier: 'Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Cider Vinegar' },
    { name: 'Water' },
    { name: 'Natural Apple Flavor' },
    { name: 'Honey' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Red Chili' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Cooking Sherry' },
  ],

  // ─── Spanish Verde line ─────────────────────────
  'spanish-verde-mild': [
    { name: 'Tomatillos' },
    { name: 'Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Water' },
    { name: 'Jalapeno Peppers' },
    { name: 'Cilantro' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Salt' },
  ],

  'spanish-verde-hot': [
    { name: 'Tomatillos' },
    { name: 'Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Water' },
    { name: 'Serrano Peppers' },
    { name: 'Cilantro' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Garlic' },
    { name: 'Spices' },
    { name: 'Salt' },
  ],

  'spanish-verde-xx-hot': [
    { name: 'Tomatillos' },
    { name: 'Chilies', qualifier: 'Chilies, Salt, Vinegar, Calcium Chloride' },
    { name: 'Onions' },
    { name: 'Jalapeno Peppers' },
    { name: 'Habanero Peppers' },
    { name: 'Lime Juice', qualifier: 'From Concentrate' },
    { name: 'Water' },
    { name: 'Cilantro' },
    { name: 'Concentrated Pepper Oil' },
    { name: 'Salt' },
    { name: 'Spices' },
  ],
}

// ─── Main seeding function ──────────────────────────────────────────────────
async function main() {
  console.log('Starting nutrition & ingredients seed...\n')

  // 1. Get all products
  const products = await prisma.product.findMany({ select: { id: true, slug: true, name: true } })
  console.log(`Found ${products.length} products in database`)

  // 2. Collect all unique ingredient names
  const allIngredientNames = new Set<string>()
  for (const entries of Object.values(ingredientData)) {
    for (const entry of entries) {
      allIngredientNames.add(entry.name)
    }
  }
  console.log(`Found ${allIngredientNames.size} unique ingredients to create`)

  // 3. Upsert all ingredients
  const ingredientMap = new Map<string, string>() // name -> id
  for (const name of allIngredientNames) {
    const ingredient = await prisma.ingredient.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    ingredientMap.set(name, ingredient.id)
  }
  console.log(`Upserted ${ingredientMap.size} ingredients`)

  // 4. Process each product
  let nutritionCount = 0
  let ingredientLinkCount = 0

  for (const product of products) {
    // ─── Nutrition ───
    const nutrition = nutritionData[product.slug]
    if (nutrition) {
      // Delete existing if any, then create
      await prisma.nutritionalInfo.deleteMany({ where: { productId: product.id } })
      await prisma.nutritionalInfo.create({
        data: {
          productId: product.id,
          ...nutrition,
        },
      })
      nutritionCount++
    } else {
      console.warn(`  ⚠ No nutrition data for: ${product.slug}`)
    }

    // ─── Ingredients ───
    const ingredients = ingredientData[product.slug]
    if (ingredients) {
      // Delete existing product-ingredient links
      await prisma.productIngredient.deleteMany({ where: { productId: product.id } })

      for (let i = 0; i < ingredients.length; i++) {
        const entry = ingredients[i]
        const ingredientId = ingredientMap.get(entry.name)
        if (!ingredientId) {
          console.warn(`  ⚠ Ingredient not found: ${entry.name}`)
          continue
        }
        await prisma.productIngredient.create({
          data: {
            productId: product.id,
            ingredientId,
            sortOrder: i,
            qualifier: entry.qualifier ?? null,
          },
        })
        ingredientLinkCount++
      }
    } else {
      console.warn(`  ⚠ No ingredient data for: ${product.slug}`)
    }
  }

  console.log(`\n✅ Created ${nutritionCount} nutritional info records`)
  console.log(`✅ Created ${ingredientLinkCount} product-ingredient links`)
  console.log('\nSeed complete!')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
