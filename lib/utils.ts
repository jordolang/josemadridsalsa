import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Price formatting utility
export function formatPrice(price: number | string | Decimal): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : Number(price)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numericPrice)
}

// Heat level utilities
export function getHeatLevelColor(heatLevel: string): string {
  switch (heatLevel?.toUpperCase()) {
    case 'MILD':
      return 'bg-verde-100 text-verde-800 border-verde-200'
    case 'MEDIUM':
      return 'bg-chile-100 text-chile-800 border-chile-200'
    case 'HOT':
      return 'bg-salsa-100 text-salsa-800 border-salsa-200'
    case 'EXTRA_HOT':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'FRUIT':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export function getHeatLevelText(heatLevel: string): string {
  switch (heatLevel?.toUpperCase()) {
    case 'MILD':
      return 'Mild'
    case 'MEDIUM':
      return 'Medium'
    case 'HOT':
      return 'Hot'
    case 'EXTRA_HOT':
      return 'Extra Hot'
    case 'FRUIT':
      return 'Fruit'
    default:
      return heatLevel || 'Unknown'
  }
}

// Add Decimal type for TypeScript
type Decimal = {
  toString(): string;
  valueOf(): number;
};
