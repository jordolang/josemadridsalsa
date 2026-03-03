'use client'

interface NutritionFactsLabelProps {
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
}

export function NutritionFactsLabel({
  servingSize,
  servingsPerContainer,
  calories,
  caloriesFromFat,
  totalFatG,
  totalFatDV,
  saturatedFatG,
  saturatedFatDV,
  transFatG,
  cholesterolMg,
  cholesterolDV,
  sodiumMg,
  sodiumDV,
  totalCarbG,
  totalCarbDV,
  dietaryFiberG,
  dietaryFiberDV,
  sugarsG,
  proteinG,
  vitaminADV,
  vitaminCDV,
  calciumDV,
  ironDV,
}: NutritionFactsLabelProps) {
  return (
    <div className="w-full max-w-[280px] border-2 border-black dark:border-white p-1 font-sans text-black dark:text-white bg-white dark:bg-neutral-900">
      {/* Title */}
      <div className="text-[2rem] leading-none font-extrabold tracking-tight border-b border-black dark:border-white pb-0.5">
        Nutrition Facts
      </div>

      {/* Serving info */}
      <div className="text-xs leading-tight pt-0.5">
        <div className="flex justify-between">
          <span className="font-bold">Serving Size</span>
          <span>{servingSize}</span>
        </div>
        <div className="flex justify-between border-b-[8px] border-black dark:border-white pb-0.5">
          <span className="font-bold">Servings Per Container</span>
          <span>{servingsPerContainer}</span>
        </div>
      </div>

      {/* Amount per serving header */}
      <div className="text-xs border-b border-black dark:border-white py-0.5">
        <span className="font-bold">Amount Per Serving</span>
      </div>

      {/* Calories row */}
      <div className="flex justify-between items-baseline border-b-[4px] border-black dark:border-white py-0.5">
        <div>
          <span className="text-sm font-extrabold">Calories</span>{' '}
          <span className="text-xl font-extrabold">{calories}</span>
        </div>
        <div className="text-xs">
          Calories from Fat {caloriesFromFat}
        </div>
      </div>

      {/* % Daily Value header */}
      <div className="text-xs text-right border-b border-black dark:border-white py-0.5">
        <span className="font-bold">% Daily Value*</span>
      </div>

      {/* Total Fat */}
      <NutrientRow
        label="Total Fat"
        value={`${totalFatG}g`}
        dv={totalFatDV}
        bold
      />

      {/* Saturated Fat (indented) */}
      <NutrientRow
        label="Saturated Fat"
        value={`${saturatedFatG}g`}
        dv={saturatedFatDV}
        indented
      />

      {/* Trans Fat (indented, no DV) */}
      <NutrientRow
        label="Trans Fat"
        value={`${transFatG}g`}
        indented
      />

      {/* Cholesterol */}
      <NutrientRow
        label="Cholesterol"
        value={`${cholesterolMg}mg`}
        dv={cholesterolDV}
        bold
      />

      {/* Sodium */}
      <NutrientRow
        label="Sodium"
        value={`${sodiumMg}mg`}
        dv={sodiumDV}
        bold
      />

      {/* Total Carbohydrate */}
      <NutrientRow
        label="Total Carbohydrate"
        value={`${totalCarbG}g`}
        dv={totalCarbDV}
        bold
      />

      {/* Dietary Fiber (indented) */}
      <NutrientRow
        label="Dietary Fiber"
        value={`${dietaryFiberG}g`}
        dv={dietaryFiberDV}
        indented
      />

      {/* Sugars (indented, no DV) */}
      <NutrientRow
        label="Sugars"
        value={`${sugarsG}g`}
        indented
      />

      {/* Protein */}
      <NutrientRow
        label="Protein"
        value={`${proteinG}g`}
        bold
        thickBorder
      />

      {/* Vitamins and Minerals */}
      <div className="flex flex-wrap text-xs border-b-[4px] border-black dark:border-white py-1 gap-x-1">
        <VitaminMineral label="Vitamin A" dv={vitaminADV} />
        <span aria-hidden>•</span>
        <VitaminMineral label="Vitamin C" dv={vitaminCDV} />
        <span aria-hidden>•</span>
        <VitaminMineral label="Calcium" dv={calciumDV} />
        <span aria-hidden>•</span>
        <VitaminMineral label="Iron" dv={ironDV} />
      </div>

      {/* Footnote */}
      <div className="text-[0.6rem] leading-tight pt-1 pb-0.5">
        * Percent Daily Values are based on a 2,000 calorie diet.
      </div>
    </div>
  )
}

function NutrientRow({
  label,
  value,
  dv,
  bold = false,
  indented = false,
  thickBorder = false,
}: {
  label: string
  value: string
  dv?: number
  bold?: boolean
  indented?: boolean
  thickBorder?: boolean
}) {
  const borderClass = thickBorder
    ? 'border-b-[4px] border-black dark:border-white'
    : 'border-b border-black dark:border-white'

  return (
    <div className={`flex justify-between text-xs py-0.5 ${borderClass}`}>
      <div className={indented ? 'pl-4' : ''}>
        <span className={bold ? 'font-bold' : ''}>{label}</span>{' '}
        <span>{value}</span>
      </div>
      {dv !== undefined && <span className="font-bold">{dv}%</span>}
    </div>
  )
}

function VitaminMineral({ label, dv }: { label: string; dv: number }) {
  return (
    <span>
      {label} {dv}%
    </span>
  )
}
