/**
 * The account that owns the Developer Console (super admin).
 * This email is automatically promoted to the DEVELOPER role at sign-in.
 */
export const DEVELOPER_ACCOUNT_EMAIL = 'jordolang@gmail.com'

/**
 * The only accounts permitted to erase records. Deleting a User cascades to
 * everything they own — including their timeclock history, which is otherwise
 * append-only — so the destructive paths are held to the owner accounts rather
 * than to anyone holding `users:write`.
 */
export const DATA_ERASURE_EMAILS = ['jordolang@gmail.com', 'mike@josemadridsalsa.com'] as const

/** Whether an account may erase records. Email comparison is case-insensitive. */
export function canEraseData(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  return DATA_ERASURE_EMAILS.some(allowed => allowed === normalized)
}
