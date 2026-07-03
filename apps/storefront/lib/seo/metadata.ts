import { getCachedSeoConfiguration, SeoConfig } from './configuration'
import { renderTemplate, TemplateEntity } from './templates'

export { renderTemplate, TEMPLATE_VARIABLES } from './templates'
export type { TemplateEntity } from './templates'

const TEMPLATE_FIELDS: Record<
  TemplateEntity,
  { title: keyof SeoConfig; description: keyof SeoConfig }
> = {
  product: { title: 'productTitleTemplate', description: 'productDescTemplate' },
  category: { title: 'categoryTitleTemplate', description: 'categoryDescTemplate' },
  recipe: { title: 'recipeTitleTemplate', description: 'recipeDescTemplate' },
  location: { title: 'locationTitleTemplate', description: 'locationDescTemplate' },
}

export interface TemplatedMetaInput {
  entity: TemplateEntity
  variables: Record<string, string>
  /** Explicit per-record overrides (e.g. product.metaTitle) always win. */
  overrideTitle?: string | null
  overrideDescription?: string | null
  /** Used when no override and no template is configured. */
  fallbackTitle: string
  fallbackDescription: string
}

/**
 * Resolve the meta title/description for a page:
 * explicit override → configured template → fallback.
 */
export async function buildTemplatedMeta(input: TemplatedMetaInput): Promise<{
  title: string
  description: string
}> {
  const config = await getCachedSeoConfiguration()
  const fields = TEMPLATE_FIELDS[input.entity]

  const variables = {
    site_name: config?.siteName || 'Jose Madrid Salsa',
    ...input.variables,
  }

  const titleTemplate = config?.[fields.title] as string | undefined
  const descTemplate = config?.[fields.description] as string | undefined

  const title =
    input.overrideTitle ||
    (titleTemplate ? renderTemplate(titleTemplate, variables) : '') ||
    input.fallbackTitle

  const description =
    input.overrideDescription ||
    (descTemplate ? renderTemplate(descTemplate, variables) : '') ||
    input.fallbackDescription

  return { title, description }
}
