import { describe, it, expect } from 'vitest'

import {
  formatIngredient,
  formatIngredientName,
  formatIngredientStatement,
  findUnbalancedIngredient,
  hasBalancedParentheses,
  parseIngredientStatement,
  parseLabelIngredients,
  splitIngredientList,
  toIngredientList,
} from '@/lib/ingredients'

// The statement printed on a jar of Jose Madrid Original Mild.
const ORIGINAL_MILD_LABEL = `
www.josemadridsalsa.com

Ingredients: Diced Tomatoes (Tomatoes, Citric Acid,
Calcium Chloride), Crushed Tomatoes (Tomatoes,
Citric Acid), Green Chilies (Salt, Vinegar, Calcium
Chloride), Water, Garlic, Lime Juice (From
Concentrate) and Spices.

Use salsa as a dip, condiment or dressing.

Nutrition Facts
Serving Size 2 Tbls.
`

const ORIGINAL_MILD_STATEMENT =
  'Diced Tomatoes (Tomatoes, Citric Acid, Calcium Chloride), ' +
  'Crushed Tomatoes (Tomatoes, Citric Acid), ' +
  'Green Chilies (Salt, Vinegar, Calcium Chloride), ' +
  'Water, Garlic, Lime Juice (From Concentrate) and Spices.'

describe('formatIngredientName', () => {
  it('wraps sub-ingredients in the parentheses the label prints', () => {
    expect(formatIngredientName('Diced Tomatoes', 'Tomatoes, Citric Acid')).toBe(
      'Diced Tomatoes (Tomatoes, Citric Acid)'
    )
  })

  it('leaves an ingredient without sub-ingredients alone', () => {
    expect(formatIngredientName('Garlic', null)).toBe('Garlic')
    expect(formatIngredientName('Garlic', '  ')).toBe('Garlic')
  })
})

describe('toIngredientList', () => {
  it('returns entries in label order with their parentheses intact', () => {
    const entries = [
      { sortOrder: 1, qualifier: 'From Concentrate', ingredient: { name: 'Lime Juice' } },
      { sortOrder: 0, qualifier: 'Tomatoes, Citric Acid', ingredient: { name: 'Diced Tomatoes' } },
    ]

    expect(toIngredientList(entries)).toEqual([
      'Diced Tomatoes (Tomatoes, Citric Acid)',
      'Lime Juice (From Concentrate)',
    ])
  })

  it('never promotes a sub-ingredient to its own entry', () => {
    const entry = {
      sortOrder: 0,
      qualifier: 'Tomatoes, Citric Acid',
      ingredient: { name: 'Diced Tomatoes' },
    }

    expect(toIngredientList([entry])).toHaveLength(1)
    expect(formatIngredient(entry)).not.toBe('Diced Tomatoes, Tomatoes, Citric Acid')
  })
})

describe('formatIngredientStatement', () => {
  it('joins with commas and an "and" before the last ingredient', () => {
    expect(formatIngredientStatement(['Tomatoes (Citric Acid)', 'Water', 'Spices'])).toBe(
      'Tomatoes (Citric Acid), Water and Spices.'
    )
  })

  it('handles a single ingredient and an empty list', () => {
    expect(formatIngredientStatement(['Tomatillos'])).toBe('Tomatillos.')
    expect(formatIngredientStatement([])).toBe('')
    expect(formatIngredientStatement(['  '])).toBe('')
  })
})

describe('findUnbalancedIngredient', () => {
  it('returns nothing when every group closes', () => {
    expect(
      findUnbalancedIngredient(['Diced Tomatoes (Tomatoes, Citric Acid)', 'Water'])
    ).toBeUndefined()
  })

  it('names the first ingredient whose group never closes', () => {
    expect(
      findUnbalancedIngredient(['Water', 'Diced Tomatoes (Tomatoes, Citric Acid', 'Salt('])
    ).toBe('Diced Tomatoes (Tomatoes, Citric Acid')
  })
})

describe('splitIngredientList', () => {
  it('keeps commas inside a parenthesised group with their ingredient', () => {
    expect(splitIngredientList('Diced Tomatoes (Tomatoes, Citric Acid), Water, Garlic')).toEqual([
      'Diced Tomatoes (Tomatoes, Citric Acid)',
      'Water',
      'Garlic',
    ])
  })

  it('handles nested groups', () => {
    expect(
      splitIngredientList('Cheese Sauce (Oil (Canola Oil, Soybean Oil), Whey), Salt')
    ).toEqual(['Cheese Sauce (Oil (Canola Oil, Soybean Oil), Whey)', 'Salt'])
  })

  it('drops empty segments', () => {
    expect(splitIngredientList('Water, , Salt,')).toEqual(['Water', 'Salt'])
  })
})

describe('hasBalancedParentheses', () => {
  it('accepts balanced text and rejects a dropped closer', () => {
    expect(hasBalancedParentheses('Tomatoes (Water, Citric Acid)')).toBe(true)
    expect(hasBalancedParentheses('Tomatoes (Water, Citric Acid')).toBe(false)
    expect(hasBalancedParentheses('Tomatoes) Water')).toBe(false)
  })

  it('rejects a group closed by the wrong delimiter', () => {
    // The strawberry scan reads "Calcium Chloride}" where the label prints "Calcium Chloride)".
    // Counting depth alone would call this balanced and publish it as label copy.
    expect(hasBalancedParentheses('Tomatoes (Water, Citric Acid}')).toBe(false)
    expect(hasBalancedParentheses('Tomatoes [Water, Citric Acid)')).toBe(false)
    expect(hasBalancedParentheses('Sauce (Oil (Canola Oil), Whey)')).toBe(true)
  })
})

describe('parseIngredientStatement', () => {
  it('reads back a statement pasted exactly as the label prints it', () => {
    expect(
      parseIngredientStatement('Diced Tomatoes (Tomatoes, Citric Acid), Water and Spices.')
    ).toEqual(['Diced Tomatoes (Tomatoes, Citric Acid)', 'Water', 'Spices'])
  })

  it('does not leave the conjunction or the period on the last ingredient', () => {
    // Otherwise the storefront renders "... and and Spices.." on the next page load.
    const ingredients = parseIngredientStatement('Water, Garlic and Spices.')

    expect(ingredients[ingredients.length - 1]).toBe('Spices')
    expect(formatIngredientStatement(ingredients)).toBe('Water, Garlic and Spices.')
  })

  it('handles an Oxford comma before the conjunction', () => {
    expect(parseIngredientStatement('Spices, Salt, and Citric Acid.')).toEqual([
      'Spices',
      'Salt',
      'Citric Acid',
    ])
  })

  it('keeps an ingredient whose name merely starts with "and"', () => {
    // The conjunction strip requires whitespace after "and", so "Andouille" is not a prefix match.
    expect(parseIngredientStatement('Onions, Spices, and Andouille Sausage.')).toEqual([
      'Onions',
      'Spices',
      'Andouille Sausage',
    ])
    expect(parseIngredientStatement('Andouille Sausage, Onions and Spices.')[0]).toBe(
      'Andouille Sausage'
    )
  })

  it('keeps a compound name whose "and" is part of the ingredient', () => {
    // "Natural and Artificial Flavors" is one regulated ingredient, not two.
    expect(parseIngredientStatement('Water, Natural and Artificial Flavors.')).toEqual([
      'Water',
      'Natural and Artificial Flavors',
    ])
  })

  it('splits at the conjunction before a compound name, not inside it', () => {
    expect(parseIngredientStatement('Water, Garlic and Natural and Artificial Flavors.')).toEqual([
      'Water',
      'Garlic',
      'Natural and Artificial Flavors',
    ])
  })

  it('leaves an ordinary comma-separated list alone', () => {
    expect(parseIngredientStatement('Tomatoes, Onions, Garlic')).toEqual([
      'Tomatoes',
      'Onions',
      'Garlic',
    ])
  })
})

describe('parseLabelIngredients', () => {
  it('reads a label back exactly as it is printed', () => {
    const { ingredients, warnings } = parseLabelIngredients(ORIGINAL_MILD_LABEL)

    expect(warnings).toEqual([])
    expect(ingredients).toEqual([
      'Diced Tomatoes (Tomatoes, Citric Acid, Calcium Chloride)',
      'Crushed Tomatoes (Tomatoes, Citric Acid)',
      'Green Chilies (Salt, Vinegar, Calcium Chloride)',
      'Water',
      'Garlic',
      'Lime Juice (From Concentrate)',
      'Spices',
    ])
    expect(formatIngredientStatement(ingredients)).toBe(ORIGINAL_MILD_STATEMENT)
  })

  it('does not flatten a sub-ingredient into a top-level ingredient', () => {
    const { ingredients } = parseLabelIngredients(ORIGINAL_MILD_LABEL)

    expect(ingredients).not.toContain('Citric Acid')
    expect(ingredients[1]).toBe('Crushed Tomatoes (Tomatoes, Citric Acid)')
  })

  it('keeps duplicate names that the label repeats at different levels', () => {
    const { ingredients } = parseLabelIngredients(
      'Ingredients: Crushed Tomatoes (Tomatoes, Citric Acid), Citric Acid and Salt.'
    )

    expect(ingredients).toEqual([
      'Crushed Tomatoes (Tomatoes, Citric Acid)',
      'Citric Acid',
      'Salt',
    ])
  })

  it('reads through an OCR column break inside a parenthesised group', () => {
    const { ingredients } = parseLabelIngredients(
      'Ingredients: Tomatillos, Chilies (Chilies, Salt,\n\nVinegar), Onions and Salt.'
    )

    expect(ingredients).toEqual(['Tomatillos', 'Chilies (Chilies, Salt, Vinegar)', 'Onions', 'Salt'])
  })

  it('does not turn an Oxford comma into an "and" ingredient', () => {
    const { ingredients } = parseLabelIngredients('Ingredients: Onions, Spices, Salt, and Citric Acid.')

    expect(ingredients).toEqual(['Onions', 'Spices', 'Salt', 'Citric Acid'])
  })

  it('stops at the nutrition panel', () => {
    const { ingredients } = parseLabelIngredients(
      'Ingredients: Tomatillos and Salt.\nNutrition Facts\nServing Size 2 Tbls.'
    )

    expect(ingredients).toEqual(['Tomatillos', 'Salt'])
  })

  it('warns when the label has no ingredient statement', () => {
    const { ingredients, warnings } = parseLabelIngredients('NET. WT. 13 OZ. (369 g.)')

    expect(ingredients).toEqual([])
    expect(warnings).toEqual(['no "Ingredients:" statement found'])
  })

  it('warns when OCR dropped a closing parenthesis', () => {
    const { warnings } = parseLabelIngredients(
      'Ingredients: Diced Tomatoes (Tomatoes, Citric Acid, Water and Salt.'
    )

    expect(warnings.some((warning) => warning.includes('unbalanced parentheses'))).toBe(true)
  })

  it('warns when the statement never closes', () => {
    const { warnings } = parseLabelIngredients('Ingredients: Tomatillos, Onions, Salt')

    expect(warnings.some((warning) => warning.includes('no closing period'))).toBe(true)
  })

  it('warns when OCR closed a group with the wrong delimiter', () => {
    const { warnings } = parseLabelIngredients(
      'Ingredients: Diced Tomatoes (Tomatoes, Citric Acid, Calcium Chloride}, Water and Salt.'
    )

    expect(warnings.some((warning) => warning.includes('unbalanced parentheses'))).toBe(true)
  })

  it('stops at a wide gap rather than reading on into other label copy', () => {
    // The cilantro scans put border marks and marketing copy below the statement.
    const { ingredients, warnings } = parseLabelIngredients(
      'Ingredients: Green Chilies (Chilies, Salt), Onions, Cilantro,\n\nJy\n\nOL\n\nAlways Great over Chicken, Pork or Fish.'
    )

    expect(ingredients).toEqual(['Green Chilies (Chilies, Salt)', 'Onions', 'Cilantro'])
    expect(warnings.some((warning) => warning.includes('no closing period'))).toBe(true)
  })

  it('warns when a sentence one blank line down was read as ingredients', () => {
    // Too narrow a gap for the layout rule, so the copy is caught by how it reads.
    const { warnings } = parseLabelIngredients(
      'Ingredients: Onions, Cilantro,\n\nAlways Great over Chicken, Pork or Fish.'
    )

    expect(warnings.some((warning) => warning.includes('reads as label copy'))).toBe(true)
  })

  it('does not mistake a real sub-ingredient group for label copy', () => {
    // "Contains 2% or less Water" is printed inside the parentheses on the queso label.
    const { ingredients, warnings } = parseLabelIngredients(
      'Ingredients: Cheddar Cheese Sauce (Oil (Canola Oil, Soybean Oil), Contains 2% or less Water) and Salt.'
    )

    expect(warnings).toEqual([])
    expect(ingredients).toEqual([
      'Cheddar Cheese Sauce (Oil (Canola Oil, Soybean Oil), Contains 2% or less Water)',
      'Salt',
    ])
  })
})
