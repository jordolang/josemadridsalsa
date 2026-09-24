import { cookies } from 'next/headers'
import { getCurrentUser, isStaff } from '@/lib/rbac'

/**
 * Who is collecting waivers: the signed-in staff member's email, or
 * 'admin-token' for the shared admin cookie. Mirrors requireAdminSession
 * without the redirect, for API routes. Returns null for anyone else.
 */
export async function resolveWaiverStaff(): Promise<string | null> {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (process.env.ADMIN_SECRET_TOKEN && adminToken === process.env.ADMIN_SECRET_TOKEN) {
    return 'admin-token'
  }

  const user = await getCurrentUser()
  if (user && isStaff(user)) return user.email || user.id
  return null
}
