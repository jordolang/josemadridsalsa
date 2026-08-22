/**
 * Parses the ingredient statement out of each OCR'd label in
 * scripts/ingredients-text/ and writes data/ingredients.json for
 * update-ingredients-db.cjs to load into Product.ingredients.
 *
 * The statement is kept exactly as printed on the jar — parenthesised
 * sub-ingredients stay attached to the ingredient they belong to. Labels the
 * scan cannot be trusted on are reported and left out of the output.
 *
 * Run: npx tsx scripts/parse-ingredients.ts
 */
import fs from 'fs'
import path from 'path'

import { formatIngredientStatement, parseLabelIngredients } from '@/lib/ingredients'

const ingredientsTextDir = path.join(__dirname, 'ingredients-text')
const outputDir = path.join(__dirname, '..', 'data')
const outputFile = path.join(outputDir, 'ingredients.json')

function main() {
  if (!fs.existsSync(ingredientsTextDir)) {
    console.error(`Directory not found: ${ingredientsTextDir}`)
    process.exit(1)
  }

  fs.mkdirSync(outputDir, { recursive: true })

  const files = fs.readdirSync(ingredientsTextDir).filter((file) => file.endsWith('.txt'))
  const allIngredients: Record<string, string[]> = {}
  const needsReview: string[] = []

  for (const file of files) {
    const slug = path.basename(file, '.txt')
    const content = fs.readFileSync(path.join(ingredientsTextDir, file), 'utf-8')
    const { ingredients, warnings } = parseLabelIngredients(content)

    for (const warning of warnings) {
      console.warn(`⚠ ${slug}: ${warning}`)
    }

    if (ingredients.length === 0 || warnings.length > 0) {
      needsReview.push(slug)
      continue
    }

    console.log(`✓ ${slug}`)
    console.log(`  ${formatIngredientStatement(ingredients)}`)
    allIngredients[slug] = ingredients
  }

  fs.writeFileSync(outputFile, JSON.stringify(allIngredients, null, 2))
  console.log(`\n${Object.keys(allIngredients).length} labels written to ${outputFile}`)

  if (needsReview.length > 0) {
    console.log(
      `\n${needsReview.length} labels skipped — re-scan or hand-correct their text in ` +
        `${path.relative(process.cwd(), ingredientsTextDir)}, then re-run:`
    )
    for (const slug of needsReview) {
      console.log(`  - ${slug}`)
    }
  }
}

main()
