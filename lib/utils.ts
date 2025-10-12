import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a price number as currency string
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

/**
 * Returns the appropriate color classes for heat level badges
 */
export function getHeatLevelColor(heatLevel: string): string {
  switch (heatLevel.toUpperCase()) {
    case 'MILD':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'HOT':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'EXTRA_HOT':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'FRUIT':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

/**
 * Returns the display text for heat levels
 */
export function getHeatLevelText(heatLevel: string): string {
  switch (heatLevel.toUpperCase()) {
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
      return 'Unknown'
  }
}
