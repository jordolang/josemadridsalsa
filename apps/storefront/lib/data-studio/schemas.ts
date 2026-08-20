/**
 * Validation for a Data Studio question.
 *
 * The registry is the allowlist. A spec may only name a dataset that exists, measures and dimensions
 * that dataset declares, filters on fields it exposes with operators it permits, and a grain its time
 * axis supports. Anything else is rejected before a query is built, which is what lets the executor
 * interpolate field names into a Prisma `where` without a raw-SQL escape hatch.
 *
 * Note what cannot be expressed here at all: a spec names exactly one `datasetId`, so measures from
 * two different bases can never appear in one result. The rule that QuickBooks figures, filed summary
 * figures and ledger rows may be compared but never summed is therefore enforced by the shape of the
 * spec rather than by a check that could be forgotten.
 */
import { z } from 'zod'

import { getDataset } from './registry'
import { parseIsoDate } from './grain'
import { TIME_GRAINS, VIZ_TYPES, type QuerySpec } from './types'

const FILTER_OPS = ['eq', 'neq', 'in', 'gte', 'lte', 'contains', 'isNull', 'notNull'] as const

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => parseIsoDate(value) !== null, 'Not a real calendar date')

const filterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(FILTER_OPS),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
    .optional(),
})

/** Shape check only. Registry agreement is applied by `parseQuerySpec` below. */
const baseSpecSchema = z.object({
  specVersion: z.literal(1),
  datasetId: z.string().min(1),
  measureIds: z.array(z.string().min(1)).min(1, 'Pick at least one measure').max(6),
  dimensionId: z.string().min(1).optional(),
  timeGrain: z.enum(TIME_GRAINS as unknown as [string, ...string[]]).optional(),
  dateRange: z.object({ from: isoDate, to: isoDate }).optional(),
  years: z.array(z.number().int().min(1900).max(2200)).max(60).optional(),
  filters: z.array(filterSchema).max(12).default([]),
  compare: z.enum(['none', 'previous-period', 'previous-year']).optional(),
  sort: z.object({ columnId: z.string().min(1), dir: z.enum(['asc', 'desc']) }).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  vizType: z.enum(VIZ_TYPES as unknown as [string, ...string[]]),
  labelOverrides: z.record(z.string(), z.string()).optional(),
})

export type QuerySpecInput = z.input<typeof baseSpecSchema>

export const querySpecSchema = baseSpecSchema.superRefine((spec, ctx) => {
  const dataset = getDataset(spec.datasetId)
  if (!dataset) {
    ctx.addIssue({ code: 'custom', path: ['datasetId'], message: `Unknown dataset "${spec.datasetId}"` })
    return
  }

  for (const [index, id] of spec.measureIds.entries()) {
    if (!dataset.measures.some((measure) => measure.id === id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['measureIds', index],
        message: `"${id}" is not a measure of ${dataset.label}`,
      })
    }
  }

  if (new Set(spec.measureIds).size !== spec.measureIds.length) {
    ctx.addIssue({ code: 'custom', path: ['measureIds'], message: 'The same measure is listed twice' })
  }

  if (spec.dimensionId && !dataset.dimensions.some((d) => d.id === spec.dimensionId)) {
    ctx.addIssue({
      code: 'custom',
      path: ['dimensionId'],
      message: `"${spec.dimensionId}" is not a dimension of ${dataset.label}`,
    })
  }

  // A grid of measure x member columns is unreadable, so splitting a series by a dimension allows
  // exactly one measure. The aggregate fold relies on this.
  if (spec.dimensionId && spec.timeGrain && spec.measureIds.length > 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['measureIds'],
      message: 'Choose one measure when splitting a time series by a dimension',
    })
  }

  const axis = dataset.timeAxis
  if (spec.timeGrain) {
    const allowed = axis.kind === 'year' ? ['year'] : axis.grains
    if (!allowed.includes(spec.timeGrain as never)) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeGrain'],
        message:
          axis.kind === 'year'
            ? `${dataset.label} records only a year, so it can only be grouped by year`
            : `${dataset.label} cannot be grouped by ${spec.timeGrain}`,
      })
    }
  }

  if (axis.kind === 'year' && spec.dateRange) {
    ctx.addIssue({
      code: 'custom',
      path: ['dateRange'],
      message: `${dataset.label} has no date column — filter it by year instead`,
    })
  }

  if (spec.dateRange) {
    const from = parseIsoDate(spec.dateRange.from)
    const to = parseIsoDate(spec.dateRange.to)
    if (from && to && spec.dateRange.from > spec.dateRange.to) {
      ctx.addIssue({ code: 'custom', path: ['dateRange'], message: 'The start date is after the end date' })
    }
  }

  for (const [index, filter] of spec.filters.entries()) {
    const definition = dataset.filters.find((f) => f.field === filter.field || f.id === filter.field)
    if (!definition) {
      ctx.addIssue({
        code: 'custom',
        path: ['filters', index, 'field'],
        message: `${dataset.label} cannot be filtered by "${filter.field}"`,
      })
      continue
    }
    if (!definition.ops.includes(filter.op)) {
      ctx.addIssue({
        code: 'custom',
        path: ['filters', index, 'op'],
        message: `"${definition.label}" does not support ${filter.op}`,
      })
    }
    // A filter over a closed vocabulary may only name a member of it, so an enum value can never
    // reach Prisma unchecked.
    if (definition.values && filter.value !== undefined && filter.value !== null) {
      const supplied = Array.isArray(filter.value) ? filter.value : [String(filter.value)]
      for (const value of supplied) {
        if (!definition.values.includes(String(value))) {
          ctx.addIssue({
            code: 'custom',
            path: ['filters', index, 'value'],
            message: `"${value}" is not a valid ${definition.label}`,
          })
        }
      }
    }
    if ((filter.op === 'in' || filter.op === 'contains') && filter.value === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['filters', index, 'value'],
        message: `"${definition.label}" needs a value`,
      })
    }
  }

  if (spec.vizType === 'pie' && spec.measureIds.length > 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['vizType'],
      message: 'A pie chart shows one measure at a time',
    })
  }
})

export type ParsedSpec =
  | { ok: true; spec: QuerySpec }
  | { ok: false; message: string; issues: string[] }

/**
 * Validate a spec, including one saved against an older registry.
 *
 * Saved reports outlive the registry that produced them, so a definition naming a measure that has
 * since been renamed must fail legibly here rather than crash the viewer. The caller renders the
 * message as "this report needs updating".
 */
export function parseQuerySpec(input: unknown): ParsedSpec {
  const result = querySpecSchema.safeParse(input)
  if (result.success) {
    return { ok: true, spec: result.data as QuerySpec }
  }
  const issues = result.error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message
  )
  return { ok: false, message: issues[0] ?? 'This report is not valid', issues }
}

export const savedReportInputSchema = z.object({
  name: z.string().trim().min(1, 'Give the report a name').max(120),
  description: z.string().trim().max(500).optional(),
  spec: z.unknown(),
})
