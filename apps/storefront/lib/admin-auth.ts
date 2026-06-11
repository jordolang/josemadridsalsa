import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/rbac";

export async function requireAdminSession(): Promise<{ id: string; email?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (process.env.ADMIN_SECRET_TOKEN && token === process.env.ADMIN_SECRET_TOKEN) {
    return { id: "admin", email: "mike@josemadridsalsa.com" };
  }

  const user = await getCurrentUser();
  if (user && isStaff(user)) {
    return { id: user.id, email: user.email };
  }

  const headerList = await headers();
  const path = headerList.get("x-pathname") || "/admin/fundraisers";
  redirect(`/auth/signin?callbackUrl=${encodeURIComponent(path)}`);
}
