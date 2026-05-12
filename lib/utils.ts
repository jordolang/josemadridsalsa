import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes with conflict resolution.
 *
 * Combines multiple class values using clsx for conditional logic,
 * then passes through tailwind-merge to resolve conflicting utilities
 * (e.g., `p-2` and `p-4` → `p-4`).
 *
 * @param inputs - Class values (strings, arrays, objects, or conditionals)
 * @returns Merged and de-duplicated class string
 */
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

/**
 * Generates a unique gift certificate code
 * Format: JMS-GC-XXXX-XXXX (8 alphanumeric characters)
 */
export function generateGiftCertificateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomPart1 = Array.from({ length: 4 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
  const randomPart2 = Array.from({ length: 4 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
  return `JMS-GC-${randomPart1}-${randomPart2}`
}

/**
 * Formats gift certificate theme for display
 */
export function getGiftCertificateThemeText(theme: string): string {
  switch (theme.toUpperCase()) {
    case 'BIRTHDAY':
      return 'Birthday'
    case 'BOY_CELEBRATION':
      return 'Boy Celebration'
    case 'CHRISTMAS':
      return 'Christmas'
    case 'GENERAL':
      return 'General'
    case 'GIRL':
      return 'Girl'
    default:
      return theme
  }
}
