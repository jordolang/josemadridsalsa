import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AccountBreadcrumbs } from "@/components/account/AccountBreadcrumbs";
import { SignOutButton } from "@/components/account/SignOutButton";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your profile, orders, and settings",
};

type Props = { children: React.ReactNode };

export default async function AccountLayout({ children }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin?callbackUrl=/account");
  }

  const userRole = (session.user as any)?.role as string | undefined;
  const isStaff = userRole && ["ADMIN", "DEVELOPER", "STAFF"].includes(userRole);
  
  // Debug: log role info (remove after testing)
  console.log("[Account Layout] User role:", userRole, "isStaff:", isStaff, "Full session.user:", session.user);

  return (
    <div className="container mx-auto grid grid-cols-12 gap-6 py-8">
      <aside className="col-span-12 md:col-span-3">
        <Card className="p-4">
          <div className="mb-4">
            <div className="font-medium">{session.user?.name ?? "Account"}</div>
            <div className="text-sm text-muted-foreground">{session.user?.email}</div>
          </div>
          <nav className="grid gap-2">
            <Link href="/account" className="text-sm hover:underline">Dashboard</Link>
            <Link href="/account/orders" className="text-sm hover:underline">Orders</Link>
            <Link href="/account/settings" className="text-sm hover:underline">Settings</Link>
            {isStaff && (
              <>
                <Separator className="my-2" />
                <Link href="/admin" className="text-sm hover:underline font-medium text-blue-600">
                  Admin Panel
                </Link>
              </>
            )}
          </nav>
          <Separator className="my-3" />
          <SignOutButton />
        </Card>
      </aside>
      <main className="col-span-12 md:col-span-9">
        <div className="mb-4">
          <AccountBreadcrumbs />
        </div>
        <Separator />
        <div className="mt-4">
          {children}
        </div>
      </main>
    </div>
  );
}
