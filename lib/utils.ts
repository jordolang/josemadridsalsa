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
 * Brand-tinted color classes for heat-level badges.
 * Verde (mild) → Chile (medium) → Salsa (hot/extra-hot) → Verde (fruit, fresh).
 * Pairs with the emoji prefix returned by getHeatLevelText.
 */
export function getHeatLevelColor(heatLevel: string): string {
  switch (heatLevel.toUpperCase()) {
    case 'MILD':
      return 'bg-verde-100 text-verde-800 border-verde-200'
    case 'MEDIUM':
      return 'bg-chile-100 text-chile-800 border-chile-200'
    case 'HOT':
      return 'bg-salsa-100 text-salsa-800 border-salsa-200'
    case 'EXTRA_HOT':
      return 'bg-salsa-900 text-white border-salsa-900'
    case 'FRUIT':
      return 'bg-verde-50 text-verde-700 border-verde-200'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

/**
 * Display text for heat levels, prefixed with the category emoji.
 * Matches the UI kit's HeatBadge convention: 🌿 mild · 🌶️ medium · 🔥 hot.
 */
export function getHeatLevelText(heatLevel: string): string {
  switch (heatLevel.toUpperCase()) {
    case 'MILD':
      return '🌿 Mild'
    case 'MEDIUM':
      return '🌶️ Medium'
    case 'HOT':
      return '🔥 Hot'
    case 'EXTRA_HOT':
      return '🔥 Extra Hot'
    case 'FRUIT':
      return '🌿 Gourmet Fruit'
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
