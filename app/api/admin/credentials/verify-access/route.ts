import { getCurrentUser } from '@/lib/rbac'
import { checkCredentialAccess } from '@/lib/credentials'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return unauthorized()
    }

    const accessLevel = await checkCredentialAccess(user.email, user.role)

    return ok({ accessLevel })
  } catch (error) {
    return serverError('Failed to verify credential access', error)
  }
}
