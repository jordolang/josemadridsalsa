/**
 * Email Template Rendering
 *
 * Shared by the send path (`lib/email/sender.ts`) and the admin preview
 * (`app/admin/emails/[id]/edit`). Kept free of server-only dependencies so the
 * client can import it and preview exactly what will be sent.
 */

import Handlebars from 'handlebars'
import { getErrorMessage } from '@/lib/errors'

/**
 * Replace template variables with actual values
 *
 * Rendered with Handlebars so templates can use block helpers — `{{#each}}`
 * over line items, `{{#if}}` around optional sections — and not just flat
 * `{{variable}}` substitution.
 *
 * `noEscape` is deliberate: templates pass pre-rendered HTML through
 * variables (`{{orderItems}}`, `{{shippingAddress}}`), which Handlebars would
 * otherwise escape into visible markup. Values therefore reach the email
 * unescaped, exactly as they did under the previous regex implementation.
 */
export function substituteVariables(
  template: string,
  variables: Record<string, unknown>
): string {
  try {
    return Handlebars.compile(template, { noEscape: true })(variables)
  } catch (error) {
    // A malformed template must never take down a send. Fall back to flat
    // substitution, which handles every non-block template.
    console.error(
      '[Email] Handlebars compilation failed, falling back to flat substitution:',
      getErrorMessage(error)
    )
    return substituteVariablesFlat(template, variables)
  }
}

/**
 * Flat `{{variable}}` substitution — the fallback when a template does not
 * compile. Leaves unrecognized placeholders untouched.
 */
function substituteVariablesFlat(
  template: string,
  variables: Record<string, unknown>
): string {
  let result = template

  Object.keys(variables).forEach((key) => {
    const value = variables[key] ?? ''
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g')
    result = result.replace(regex, String(value))
  })

  return result
}
