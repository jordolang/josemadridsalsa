'use client'

import { useState } from 'react'
import { NutritionFactsLabel } from './NutritionFactsLabel'

interface NutritionalInfoData {
  id: string
  productId: string
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
  allergens: string | null
}

interface ProductIngredientData {
  id: string
  sortOrder: number
  qualifier: string | null
  ingredient: {
    id: string
    name: string
  }
}

interface NutritionalInfoProps {
  nutritionalInfo: NutritionalInfoData
  productIngredients?: ProductIngredientData[]
  ingredients?: string[] | null
}

export function NutritionalInfo({
  nutritionalInfo,
  productIngredients,
  ingredients,
}: NutritionalInfoProps) {
  const [activeTab, setActiveTab] = useState<'nutrition' | 'ingredients'>('nutrition')

  const hasIngredients =
    (productIngredients && productIngredients.length > 0) ||
    (ingredients && ingredients.length > 0)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Tab buttons */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('nutrition')}
          className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'nutrition'
              ? 'bg-card text-foreground border-b-2 border-foreground'
              : 'bg-muted/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          Nutrition Facts
        </button>
        {hasIngredients && (
          <button
            type="button"
            onClick={() => setActiveTab('ingredients')}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'ingredients'
                ? 'bg-card text-foreground border-b-2 border-foreground'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            Ingredients
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="p-4 bg-card">
        {activeTab === 'nutrition' && (
          <div className="flex justify-center">
            <NutritionFactsLabel
              servingSize={nutritionalInfo.servingSize}
              servingsPerContainer={nutritionalInfo.servingsPerContainer}
              calories={nutritionalInfo.calories}
              caloriesFromFat={nutritionalInfo.caloriesFromFat}
              totalFatG={nutritionalInfo.totalFatG}
              totalFatDV={nutritionalInfo.totalFatDV}
              saturatedFatG={nutritionalInfo.saturatedFatG}
              saturatedFatDV={nutritionalInfo.saturatedFatDV}
              transFatG={nutritionalInfo.transFatG}
              cholesterolMg={nutritionalInfo.cholesterolMg}
              cholesterolDV={nutritionalInfo.cholesterolDV}
              sodiumMg={nutritionalInfo.sodiumMg}
              sodiumDV={nutritionalInfo.sodiumDV}
              totalCarbG={nutritionalInfo.totalCarbG}
              totalCarbDV={nutritionalInfo.totalCarbDV}
              dietaryFiberG={nutritionalInfo.dietaryFiberG}
              dietaryFiberDV={nutritionalInfo.dietaryFiberDV}
              sugarsG={nutritionalInfo.sugarsG}
              proteinG={nutritionalInfo.proteinG}
              vitaminADV={nutritionalInfo.vitaminADV}
              vitaminCDV={nutritionalInfo.vitaminCDV}
              calciumDV={nutritionalInfo.calciumDV}
              ironDV={nutritionalInfo.ironDV}
            />
          </div>
        )}

        {activeTab === 'ingredients' && (
          <div className="space-y-3">
            {/* FDA-style ingredient statement from relational data */}
            {productIngredients && productIngredients.length > 0 ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Ingredients: </span>
                {formatIngredientStatement(productIngredients)}
              </p>
            ) : ingredients && ingredients.length > 0 ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Ingredients: </span>
                {ingredients.join(', ')}.
              </p>
            ) : null}

            {/* Allergens */}
            {nutritionalInfo.allergens && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm">
                  <span className="font-bold text-destructive">Contains: </span>
                  <span className="text-muted-foreground">
                    {nutritionalInfo.allergens}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Format product ingredients into an FDA-style ingredient statement.
 * e.g. "Diced Tomatoes (Tomatoes, Citric Acid, Calcium Chloride), Water, Garlic, Lime Juice (From Concentrate) and Spices."
 */
function formatIngredientStatement(
  productIngredients: ProductIngredientData[]
): string {
  const sorted = [...productIngredients].sort(
    (a, b) => a.sortOrder - b.sortOrder
  )
  const parts = sorted.map((pi) => {
    const name = pi.ingredient.name
    if (pi.qualifier) {
      return `${name} (${pi.qualifier})`
    }
    return name
  })

  if (parts.length === 0) return ''
  if (parts.length === 1) return `${parts[0]}.`

  // FDA style: comma-separated with "and" before last item
  const allButLast = parts.slice(0, -1)
  const last = parts[parts.length - 1]
  return `${allButLast.join(', ')} and ${last}.`
}
