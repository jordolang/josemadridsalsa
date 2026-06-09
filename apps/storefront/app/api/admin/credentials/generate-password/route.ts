import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { checkCredentialAccess, generatePassword } from '@/lib/credentials'

export async function GET(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:read')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (!accessLevel) {
      return fail('Forbidden - no credential access grant', 403)
    }

    const url = new URL(req.url)
    const length = parseInt(url.searchParams.get('length') || '14', 10)

    // Generate 3 suggestions
    const suggestions = [
      generatePassword(length),
      generatePassword(length),
      generatePassword(length),
    ]

    return ok({ suggestions })
  } catch (error: any) {
    return fail(error.message, error.status || 400)
  }
}
