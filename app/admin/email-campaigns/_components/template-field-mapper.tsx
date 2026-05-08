'use client'

import Link from 'next/link'
import { ExternalLink, Variable } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  VARIABLE_SOURCE_OPTIONS,
  type VariableMapping,
  type VariableMappings,
  type VariableSource,
  type VariableSourceOption,
} from '@/lib/email/variable-mapping'

export interface DiscountCodeOption {
  id: string
  code: string
  description: string | null
}

interface TemplateFieldMapperProps {
  variables: ReadonlyArray<string>
  mappings: VariableMappings
  onChange: (mappings: VariableMappings) => void
  /** Show the "CSV Column" source option when the recipients source is a CSV. */
  csvMode?: boolean
  /** Active discount codes available for the `discountCode` source. */
  discountCodes?: ReadonlyArray<DiscountCodeOption>
}

export function TemplateFieldMapper({
  variables,
  mappings,
  onChange,
  csvMode = false,
  discountCodes = [],
}: TemplateFieldMapperProps) {
  if (variables.length === 0) return null

  const sourceOptions: VariableSourceOption[] = VARIABLE_SOURCE_OPTIONS.filter(
    (opt) => (opt.value === 'csv' ? csvMode : true),
  )

  const updateMapping = (
    variable: string,
    patch: Partial<VariableMapping>,
  ): void => {
    const current = mappings[variable] ?? ({ source: 'customField' } as VariableMapping)
    onChange({ ...mappings, [variable]: { ...current, ...patch } })
  }

  const changeSource = (variable: string, source: VariableSource): void => {
    // Reset source-specific fields when switching source type
    onChange({
      ...mappings,
      [variable]: {
        source,
        key:
          source === 'customField'
            ? variable
            : source === 'discountCode' && discountCodes.length > 0
              ? discountCodes[0].id
              : undefined,
        value: undefined,
        fallback: mappings[variable]?.fallback,
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Variable className="h-5 w-5" />
          Template Field Mapping
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tell us where each <code className="rounded bg-muted px-1">{`{{token}}`}</code> in the template should pull from.
          Mix subscriber data, fixed values (like a coupon code), and CSV columns as needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {variables.map((variable) => {
          const mapping =
            mappings[variable] ?? ({ source: 'customField', key: variable } as VariableMapping)
          const option = sourceOptions.find((o) => o.value === mapping.source)

          return (
            <div
              key={variable}
              className="rounded-lg border bg-muted/30 p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <code className="rounded bg-background px-2 py-1 text-sm font-semibold">
                  {`{{${variable}}}`}
                </code>
                {option?.help && (
                  <span className="text-xs text-muted-foreground text-right">
                    {option.help}
                  </span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Source</Label>
                  <Select
                    value={mapping.source}
                    onValueChange={(v) => changeSource(variable, v as VariableSource)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {option?.needsKey && mapping.source === 'discountCode' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Discount Code</Label>
                    {discountCodes.length === 0 ? (
                      <div className="text-xs text-muted-foreground rounded border border-dashed px-2 py-2">
                        No active discount codes.{' '}
                        <Link
                          href="/admin/settings/discount-codes"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline inline-flex items-center gap-0.5"
                        >
                          Create one <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : (
                      <Select
                        value={mapping.key ?? ''}
                        onValueChange={(v) =>
                          updateMapping(variable, { key: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a code…" />
                        </SelectTrigger>
                        <SelectContent>
                          {discountCodes.map((dc) => (
                            <SelectItem key={dc.id} value={dc.id}>
                              {dc.code}
                              {dc.description ? ` — ${dc.description}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {option?.needsKey && mapping.source !== 'discountCode' && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {mapping.source === 'csv'
                        ? 'CSV Column Name'
                        : 'Custom Field Key'}
                    </Label>
                    <Input
                      value={mapping.key ?? ''}
                      onChange={(e) =>
                        updateMapping(variable, { key: e.target.value })
                      }
                      placeholder={
                        mapping.source === 'csv'
                          ? 'e.g. company'
                          : 'e.g. loyaltyTier'
                      }
                    />
                  </div>
                )}

                {option?.needsValue && (
                  <div className="space-y-1">
                    <Label className="text-xs">Fixed Value</Label>
                    <Input
                      value={mapping.value ?? ''}
                      onChange={(e) =>
                        updateMapping(variable, { value: e.target.value })
                      }
                      placeholder="e.g. SAVE20 or 20%"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Fallback (optional)</Label>
                  <Input
                    value={mapping.fallback ?? ''}
                    onChange={(e) =>
                      updateMapping(variable, { fallback: e.target.value })
                    }
                    placeholder="Default if data missing"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
