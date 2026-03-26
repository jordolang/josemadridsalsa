import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAdminSession(): Promise<{ id: string; email?: string }> {
  const cookieStore = cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (process.env.ADMIN_SECRET_TOKEN && token === process.env.ADMIN_SECRET_TOKEN) {
    return { id: "admin", email: "admin@josemadrid.net" };
  }

  // Swap for NextAuth / Clerk below if needed:
  // import { getServerSession } from "next-auth";
  // const session = await getServerSession(authOptions);
  // if (!session?.user?.isAdmin) redirect("/admin/login");
  // return { id: session.user.id };

  redirect("/admin/login");
}
