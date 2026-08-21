import { describe, it, expect } from 'vitest'

import {
  formatIngredient,
  formatIngredientName,
  formatIngredientStatement,
  hasBalancedParentheses,
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
})
