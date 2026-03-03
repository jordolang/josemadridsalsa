const fs = require('fs');
const path = require('path');

const ingredientsTextDir = path.join(__dirname, 'ingredients-text');
const outputDir = path.join(__dirname, '..', 'data');
const outputFile = path.join(outputDir, 'ingredients.json');

async function main() {
  if (!fs.existsSync(ingredientsTextDir)) {
    console.error(`Directory not found: ${ingredientsTextDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(ingredientsTextDir).filter(file => file.endsWith('.txt'));
  const allIngredients = {};

  for (const file of files) {
    const filePath = path.join(ingredientsTextDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const slug = path.basename(file, '.txt');
    
    console.log(`--- Processing ${slug} ---`);
    console.log(content);

    // TODO: Parse ingredients from content
    const ingredients = parseIngredients(content);
    allIngredients[slug] = ingredients;
  }

  fs.writeFileSync(outputFile, JSON.stringify(allIngredients, null, 2));
  console.log(`\nIngredients data saved to ${outputFile}`);
}

function parseIngredients(content) {
  const lines = content.split('\n');
  let ingredientsSection = [];
  let foundIngredientsStart = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.toLowerCase().includes('ingredients:')) {
      foundIngredientsStart = true;
      // Start collecting from here, removing the "Ingredients:" prefix
      const afterLabel = trimmedLine.substring(trimmedLine.toLowerCase().indexOf('ingredients:') + 'ingredients:'.length).replace(':', '').trim();
      if (afterLabel) {
        ingredientsSection.push(afterLabel);
      }
      continue;
    }

    if (foundIngredientsStart) {
      // Stop if we hit "Nutrition Facts" or a similar header
      if (trimmedLine.toLowerCase().includes('nutrition facts') || 
          trimmedLine.toLowerCase().includes('amount/serving') ||
          trimmedLine.toLowerCase().includes('serving size')) {
        break;
      }
      // Stop if it's a very short line that doesn't seem like an ingredient
      if (trimmedLine.length < 3 && trimmedLine !== 'or') { 
         // Allow 'or' to be processed as part of ingredient lists
        // However, if the very next line is also short, this might indicate the end of the ingredients
        const nextLineIndex = lines.indexOf(line) + 1;
        if (nextLineIndex < lines.length && lines[nextLineIndex].trim().length < 3) {
            break;
        }
      }
      ingredientsSection.push(trimmedLine);
    }
  }

  if (ingredientsSection.length === 0) {
    return [];
  }

  // Join lines and split by common delimiters
  let rawIngredients = ingredientsSection.join(' ');
  rawIngredients = rawIngredients.replace(/,(?=\S)/g, ', '); // Add space after comma if missing
  rawIngredients = rawIngredients.replace(/and /gi, ', '); // Convert "and" to comma for splitting

  let ingredients = rawIngredients.split(/,|\n/);

  // Clean up and filter
  return ingredients
    .map(ing => ing.replace(/(\(|\)|\[|\]|®|™)/g, '').replace(/\.$/, '').trim()) // Remove parentheses, brackets, symbols and trailing dots
    .filter(ing => ing.length > 2 && !/^\d+$/.test(ing)) // Remove very short strings and numbers
    .map(ing => ing.charAt(0).toUpperCase() + ing.slice(1).toLowerCase()) // Capitalize first letter and lowercase rest
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
}


main().catch(console.error);
