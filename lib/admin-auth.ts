import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAdminSession(): Promise<{ id: string; email?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (process.env.ADMIN_SECRET_TOKEN && token === process.env.ADMIN_SECRET_TOKEN) {
    return { id: "admin", email: "admin@josemadrid.net" };
  }

  // return { id: session.user.id };

  redirect("/admin/login");
}
