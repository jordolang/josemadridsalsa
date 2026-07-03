/**
 * Pure meta-template helpers, safe to import from client components
 * (no prisma / server-only dependencies).
 */

export type TemplateEntity = 'product' | 'category' | 'recipe' | 'location'

/** Variables available per entity template, documented for the admin editor. */
export const TEMPLATE_VARIABLES: Record<TemplateEntity, string[]> = {
  product: ['product_name', 'category', 'heat_level', 'price', 'site_name'],
  category: ['category_name', 'site_name'],
  recipe: ['recipe_name', 'site_name'],
  location: ['location_name', 'city', 'state', 'site_name'],
}

export function applyMetadataTemplate(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{${key}}`).join(value)
  }
  return result
}

/**
 * Fill a template and clean up any variables that had no value:
 * leftover {tokens} are removed and surrounding separators collapsed.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return applyMetadataTemplate(template, variables)
    .replace(/\{[a-z0-9_]+\}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([|,\-–])\s*$/g, '')
    .trim()
}
