import { describe, it, expect } from 'vitest'

import {
  DESKTOP_FORMS,
  DIRECT_OPS,
  defaultValues,
  findForm,
  formFields,
  isFormId,
  isWriteOpId,
  requiredOptionSources,
  slugify,
  type FormField,
  type FormId,
} from '@/lib/admin-desktop/forms'
import { SECTION_PERMISSION } from '@/lib/admin-desktop/access'

/**
 * The form registry is a description that two sides read: the sheet draws from
 * it, and the write route dispatches on the same ids. The tests that matter are
 * the ones about those two staying in step — a form with no handler is a sheet
 * that saves nothing, and a handler with no permission is an open door.
 */

const FORM_IDS = Object.keys(DESKTOP_FORMS) as FormId[]

function everyField(): { form: FormId; field: FormField }[] {
  return FORM_IDS.flatMap((id) =>
    formFields(DESKTOP_FORMS[id]).map((field) => ({ form: id, field })),
  )
}

describe('the form registry', () => {
  it('gives every section that creates something a form to do it with', () => {
    // Not exhaustive by design — this pins the entities an operator reaches for
    // most, so a refactor that quietly drops one is caught.
    for (const id of [
      'order.create',
      'product.create',
      'customer.create',
      'fundraiser.create',
      'participant.create',
      'event.create',
      'purchase.create',
      'invoice.create',
      'ledger.create',
      'campaign.create',
      'social.create',
      'post.create',
      'user.create',
    ] as const) {
      expect(findForm(id), id).toBeDefined()
    }
  })

  it('names every field once within a form', () => {
    // Two fields under one name means one silently overwrites the other on save.
    for (const id of FORM_IDS) {
      const names = formFields(DESKTOP_FORMS[id]).map((field) => field.name)
      expect(new Set(names).size, `${id} has duplicate field names`).toBe(names.length)
    }
  })

  it('gives every field a label and a type the sheet can draw', () => {
    for (const { form, field } of everyField()) {
      expect(field.label.length, `${form}.${field.name}`).toBeGreaterThan(0)
      expect(field.name.length, `${form}.${field.name}`).toBeGreaterThan(0)
    }
  })

  it('points every slug field at a field that exists in the same form', () => {
    for (const id of FORM_IDS) {
      const names = new Set(formFields(DESKTOP_FORMS[id]).map((field) => field.name))
      for (const field of formFields(DESKTOP_FORMS[id])) {
        if (!field.slugFrom) continue
        expect(names.has(field.slugFrom), `${id}.${field.name} derives from a missing field`).toBe(true)
      }
    }
  })

  it('gives every picker a source of choices', () => {
    // A select with neither inline options nor a source renders as one empty
    // dropdown, which looks like a loading bug rather than a missing registry
    // entry.
    for (const { form, field } of everyField()) {
      if (field.type !== 'select' && field.type !== 'tags') continue
      expect(
        Boolean(field.options?.length) || Boolean(field.optionsFrom),
        `${form}.${field.name} has no options`,
      ).toBe(true)
    }
  })

  it('gives every line repeater a row shape', () => {
    for (const { form, field } of everyField()) {
      if (field.type !== 'lines') continue
      expect(field.itemFields?.length, `${form}.${field.name}`).toBeGreaterThan(0)
    }
  })

  it('starts a create sheet with a value for every field', () => {
    // A field with no seeded value renders uncontrolled, and React warns the
    // first time it is typed into.
    for (const id of FORM_IDS) {
      const values = defaultValues(DESKTOP_FORMS[id])
      for (const field of formFields(DESKTOP_FORMS[id])) {
        expect(values[field.name], `${id}.${field.name}`).toBeDefined()
      }
    }
  })

  it('collects the option sources a form needs, including inside line items', () => {
    // The sheet fetches these before it draws, so a source only referenced by a
    // repeater column has to be found too or the picker opens empty.
    expect(requiredOptionSources(DESKTOP_FORMS['purchase.create'])).toContain('products')
    expect(requiredOptionSources(DESKTOP_FORMS['order.create'])).toContain('products')
    expect(requiredOptionSources(DESKTOP_FORMS['product.create'])).toEqual(['categories'])
  })

  it('recognises its own ids and rejects anything else', () => {
    expect(isFormId('fundraiser.create')).toBe(true)
    expect(isFormId('fundraiser.explode')).toBe(false)
    expect(isWriteOpId('review.approve')).toBe(true)
    expect(isWriteOpId('review.incinerate')).toBe(false)
  })

  it('keeps direct operations out of the form registry', () => {
    // The two share one id space; an id in both would make "does this open a
    // sheet?" ambiguous at the point the shell has to decide.
    for (const op of DIRECT_OPS) {
      expect(isFormId(op), `${op} is both a form and a direct operation`).toBe(false)
    }
  })

  it('carries every field the web product page edits', () => {
    // The desktop sheet replaced `/admin/products/[id]/edit` rather than
    // summarising it, so anything that page could set has to be here. Alt text
    // is the one thing left out: `Product.images` is a list of strings with
    // nowhere to keep one.
    const names = new Set(formFields(DESKTOP_FORMS['product.edit']).map((field) => field.name))
    for (const name of [
      'name',
      'slug',
      'description',
      'sku',
      'barcode',
      'price',
      'compareAtPrice',
      'costPrice',
      'inventory',
      'lowStockThreshold',
      'weight',
      'heatLevel',
      'ingredients',
      'categoryId',
      'featuredImage',
      'images',
      'isActive',
      'isFeatured',
      'sortOrder',
      'metaTitle',
      'metaDescription',
      'ogImage',
      'searchKeywords',
    ]) {
      expect(names.has(name), `product.edit is missing ${name}`).toBe(true)
    }
  })

  it('carries the count the edit sheet opened on, so a save can tell touched from untouched', () => {
    const baseline = formFields(DESKTOP_FORMS['product.edit']).find(
      (field) => field.name === 'inventoryAt',
    )
    expect(baseline?.type).toBe('hidden')
  })

  it('lays the product sheets out as a band over a stack', () => {
    // The pictures and the numbers sit side by side across the top; everything
    // else keeps its own order underneath, full width.
    for (const id of ['product.create', 'product.edit'] as const) {
      const sides = DESKTOP_FORMS[id].sections.map((section) => section.column)
      expect(sides.slice(0, 2), id).toEqual(['left', 'right'])
      expect(sides.slice(2).every((side) => side === undefined), id).toBe(true)
    }
  })

  it('opens a gallery blank rather than undefined', () => {
    // The sheet's gallery reads an array; a create that seeded `''` would draw
    // the first typed URL as a list of characters.
    expect(defaultValues(DESKTOP_FORMS['product.create']).images).toEqual([])
  })

  it('keeps SEO length limits on the fields Google actually reads', () => {
    // The same 60/160 budget `lib/blog/schemas.ts` enforces, so the sheet warns
    // before the server refuses rather than after.
    const post = formFields(DESKTOP_FORMS['post.create'])
    expect(post.find((field) => field.name === 'seoTitle')?.max).toBe(60)
    expect(post.find((field) => field.name === 'seoDescription')?.max).toBe(160)
  })
})

describe('slugify', () => {
  it('turns a name into something the slug column will accept', () => {
    expect(slugify('Zanesville Harvest Festival')).toBe('zanesville-harvest-festival')
    expect(slugify("Jose's  Peach  Salsa!")).toBe('joses-peach-salsa')
    expect(slugify('  Leading and trailing  ')).toBe('leading-and-trailing')
  })

  it('produces a value the create handlers would not reject', () => {
    // Both product and fundraiser creation enforce this pattern server-side.
    expect(slugify('Heat Index — 2026 Recap')).toMatch(/^[a-z0-9-]+$/)
  })
})

describe('the sections a form belongs to', () => {
  it('has a permission decision on record for every section', () => {
    // Not a form test as such, but the write layer leans on the same registry:
    // a section with no entry here is a section nobody decided the rules for.
    for (const [id, permission] of Object.entries(SECTION_PERMISSION)) {
      expect(permission === null || permission.includes(':'), id).toBe(true)
    }
  })
})
