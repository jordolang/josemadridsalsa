'use client'

import { FileText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { renderTemplate, TEMPLATE_VARIABLES, TemplateEntity } from '@/lib/seo/templates'
import type { SeoConfigForm, UpdateConfig } from './types'

interface Props {
  config: SeoConfigForm
  updateConfig: UpdateConfig
}

const SECTIONS: Array<{
  entity: TemplateEntity
  label: string
  titleField: keyof SeoConfigForm
  descField: keyof SeoConfigForm
  titlePlaceholder: string
  descPlaceholder: string
}> = [
  {
    entity: 'product',
    label: 'Products',
    titleField: 'productTitleTemplate',
    descField: 'productDescTemplate',
    titlePlaceholder: '{product_name} - {heat_level} Salsa | {site_name}',
    descPlaceholder: 'Buy {product_name} for {price}. Handcrafted {category} from {site_name}.',
  },
  {
    entity: 'category',
    label: 'Categories',
    titleField: 'categoryTitleTemplate',
    descField: 'categoryDescTemplate',
    titlePlaceholder: '{category_name} | {site_name}',
    descPlaceholder: 'Shop {category_name} from {site_name}.',
  },
  {
    entity: 'recipe',
    label: 'Recipes',
    titleField: 'recipeTitleTemplate',
    descField: 'recipeDescTemplate',
    titlePlaceholder: '{recipe_name} Recipe | {site_name}',
    descPlaceholder: 'Make {recipe_name} with salsa from {site_name}.',
  },
  {
    entity: 'location',
    label: 'Locations',
    titleField: 'locationTitleTemplate',
    descField: 'locationDescTemplate',
    titlePlaceholder: 'Find us at {location_name} in {city}, {state} | {site_name}',
    descPlaceholder: 'Buy {site_name} products at {location_name} in {city}, {state}.',
  },
]

const SAMPLE_VARIABLES: Record<TemplateEntity, Record<string, string>> = {
  product: {
    product_name: 'Salsa Verde',
    category: 'Green Salsas',
    heat_level: 'Medium',
    price: '$8.99',
  },
  category: { category_name: 'Hot Salsas' },
  recipe: { recipe_name: 'Salsa Chicken Enchiladas' },
  location: { location_name: 'The Market', city: 'Zanesville', state: 'OH' },
}

export function MetaTemplates({ config, updateConfig }: Props) {
  const siteName = config.siteName || 'Jose Madrid Salsa'

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Meta Tag Templates
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Templates fill in each page&apos;s meta title and description. Per-page overrides
        (a product&apos;s Meta Title field) always take precedence over templates.
      </p>
      <div className="space-y-8">
        {SECTIONS.map((section) => {
          const sampleVars = { site_name: siteName, ...SAMPLE_VARIABLES[section.entity] }
          const titleValue = (config[section.titleField] as string) || ''
          const descValue = (config[section.descField] as string) || ''

          return (
            <div key={section.entity} className="space-y-3 border-b border-border pb-6 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{section.label}</h3>
                <p className="text-xs text-muted-foreground">
                  Variables: {TEMPLATE_VARIABLES[section.entity].map((v) => `{${v}}`).join(' ')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${section.entity}-title`}>Title Template</Label>
                <Input
                  id={`${section.entity}-title`}
                  value={titleValue}
                  onChange={(e) => updateConfig(section.titleField, e.target.value as never)}
                  placeholder={section.titlePlaceholder}
                />
                {titleValue && (
                  <p className="text-xs text-muted-foreground">
                    Preview: <span className="text-foreground">{renderTemplate(titleValue, sampleVars)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${section.entity}-desc`}>Description Template</Label>
                <Input
                  id={`${section.entity}-desc`}
                  value={descValue}
                  onChange={(e) => updateConfig(section.descField, e.target.value as never)}
                  placeholder={section.descPlaceholder}
                />
                {descValue && (
                  <p className="text-xs text-muted-foreground">
                    Preview: <span className="text-foreground">{renderTemplate(descValue, sampleVars)}</span>
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
