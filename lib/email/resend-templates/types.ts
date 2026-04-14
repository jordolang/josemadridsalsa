/** Variable definition accepted by the Resend templates API. */
export interface ResendTemplateVariable {
  key: string
  type: 'string' | 'number'
  fallbackValue?: string | number | null
}

/** Everything needed to create or update a template in Resend. */
export interface ResendTemplateDefinition {
  /** Display name shown in the Resend dashboard. */
  name: string
  /** Stable slug used to reference the template when sending. */
  alias: string
  /** Default subject line (may contain {{{VAR}}} placeholders). */
  subject: string
  /** Default "from" address. */
  from: string
  /** Full HTML of the template with {{{VAR}}} placeholders. */
  html: string
  /** Plain-text fallback (optional — Resend auto-generates from HTML). */
  text?: string
  /** Variable definitions for the Resend API. */
  variables: ResendTemplateVariable[]
}
