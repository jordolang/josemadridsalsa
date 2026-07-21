import { z } from 'zod'

export const fieldSchema = z.object({
  id: z.string().min(1, 'Field id is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['short-text', 'long-text', 'checkbox', 'table', 'signature', 'date', 'number']),
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
  columns: z.array(z.string().min(1)).optional(),
  defaultRows: z.number().int().min(0).optional(),
  rows: z.array(z.array(z.string())).optional(),
  rowHeight: z.number().int().min(0).optional(),
})

export const sectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  defaultIncluded: z.boolean().optional(),
  fields: z.array(fieldSchema).min(1, 'Add at least one field to each section'),
  columnGroup: z.string().min(1).optional(),
})

export const templatePayloadSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1).optional(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Template category is required'),
  tags: z.array(z.string().min(1)).default([]),
  estimatedCompletion: z.string().optional(),
  recommendedUses: z.array(z.string().min(1)).default([]),
  sections: z.array(sectionSchema).min(1, 'Include at least one section'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  changelogNotes: z.string().max(500).optional(),
  density: z.enum(['default', 'compact']).optional(),
})

export type TemplatePayloadInput = z.infer<typeof templatePayloadSchema>

export const templateUpdateSchema = templatePayloadSchema.partial().extend({
  sections: z.array(sectionSchema).min(1).optional(),
})

export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>

export const templateVersionInputSchema = z.object({
  sections: z.array(sectionSchema).min(1, 'Include at least one section'),
  changelogNotes: z.string().max(500).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})

export type TemplateVersionInput = z.infer<typeof templateVersionInputSchema>
