/**
 * Email template rendering tests
 *
 * Covers the Handlebars renderer shared by the send path and the admin
 * preview, including the backward-compatibility guarantees the previous
 * flat-substitution implementation provided.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { substituteVariables } from '@/lib/email/render'
import { emailTemplates } from '@/lib/email/templates/index'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('substituteVariables', () => {
  describe('flat variables (backward compatibility)', () => {
    it('replaces a simple placeholder', () => {
      expect(substituteVariables('Hi {{name}}!', { name: 'Mike' })).toBe('Hi Mike!')
    })

    it('replaces every occurrence of a placeholder', () => {
      expect(
        substituteVariables('{{a}}-{{a}}-{{a}}', { a: 'x' })
      ).toBe('x-x-x')
    })

    it('tolerates whitespace inside the braces', () => {
      expect(substituteVariables('Hi {{ name }}!', { name: 'Mike' })).toBe('Hi Mike!')
    })

    it('does not HTML-escape values, so pre-rendered HTML still works', () => {
      // Existing templates pass rendered markup through variables such as
      // {{orderItems}}. Escaping would surface raw tags to the customer.
      const html = substituteVariables('<div>{{orderItems}}</div>', {
        orderItems: '<p class="item">Salsa &amp; chips</p>',
      })

      expect(html).toBe('<div><p class="item">Salsa &amp; chips</p></div>')
    })

    it('renders a missing variable as empty rather than leaking braces', () => {
      expect(substituteVariables('Hi {{name}}!', {})).toBe('Hi !')
    })

    it('renders null and undefined as empty', () => {
      expect(
        substituteVariables('[{{a}}][{{b}}]', { a: null, b: undefined })
      ).toBe('[][]')
    })

    it('coerces non-string values', () => {
      expect(substituteVariables('{{n}} items', { n: 3 })).toBe('3 items')
    })
  })

  describe('block helpers', () => {
    it('renders an {{#each}} loop over line items', () => {
      const template = '{{#each line_items}}<li>{{item_name}} x{{item_qty}}</li>{{/each}}'

      const html = substituteVariables(template, {
        line_items: [
          { item_name: 'Black Bean', item_qty: 2 },
          { item_name: 'Peach', item_qty: 1 },
        ],
      })

      expect(html).toBe('<li>Black Bean x2</li><li>Peach x1</li>')
    })

    it('renders nothing for an empty or missing collection', () => {
      const template = 'a{{#each line_items}}<li>{{item_name}}</li>{{/each}}b'

      expect(substituteVariables(template, { line_items: [] })).toBe('ab')
      expect(substituteVariables(template, {})).toBe('ab')
    })

    it('renders an {{#if}} conditional', () => {
      const template = '{{#if tracking}}Track: {{tracking}}{{else}}Not shipped{{/if}}'

      expect(substituteVariables(template, { tracking: 'ABC' })).toBe('Track: ABC')
      expect(substituteVariables(template, {})).toBe('Not shipped')
    })
  })

  describe('malformed templates', () => {
    it('falls back to flat substitution instead of throwing', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      // An unclosed block is a Handlebars compile error.
      const result = substituteVariables('Hi {{name}} {{#each items}}', {
        name: 'Mike',
      })

      expect(result).toContain('Hi Mike')
      expect(console.error).toHaveBeenCalled()
    })
  })
})

describe('seeded email templates', () => {
  const newKeys = [
    'announcement_newsletter',
    'announcement_single',
    'order_confirmation_light',
    'order_confirmation_dark',
  ]

  it('registers the four added templates', () => {
    const keys = emailTemplates.map((template) => template.key)

    for (const key of newKeys) {
      expect(keys).toContain(key)
    }
  })

  it('keeps every template key unique so seeding cannot overwrite another', () => {
    const keys = emailTemplates.map((template) => template.key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('does not displace the existing transactional order confirmation', () => {
    expect(emailTemplates.map((t) => t.key)).toContain('order_confirmation')
  })

  it('compiles every template body without falling back', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    for (const template of emailTemplates) {
      substituteVariables(template.html, {})
      substituteVariables(template.subject, {})
    }

    expect(consoleError).not.toHaveBeenCalled()
  })

  it('renders order-confirmation line items through the {{#each}} loop', () => {
    const template = emailTemplates.find((t) => t.key === 'order_confirmation_light')
    expect(template).toBeDefined()

    const html = substituteVariables(template!.html, {
      order_number: 'JMS-1001',
      line_items: [
        {
          item_name: 'Black Bean & Corn',
          item_size: '16 oz',
          item_heat_level: 'Medium',
          item_qty: 2,
          item_line_total: '$17.98',
        },
      ],
    })

    // Values pass through unescaped, matching the previous renderer.
    expect(html).toContain('Black Bean & Corn')
    expect(html).toContain('$17.98')
    expect(html).toContain('JMS-1001')
    // No unrendered block syntax may reach the customer.
    expect(html).not.toContain('{{#each')
    expect(html).not.toContain('{{item_name}}')
  })
})
