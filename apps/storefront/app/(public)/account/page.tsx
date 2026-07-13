import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/account/OrderCard";
import { createMetadata } from "@/lib/metadata";
import { UserRole } from "@prisma/client";

export const dynamic = 'force-dynamic'


export const metadata: Metadata = createMetadata({
  title: "Account Dashboard - Jose Madrid Salsa",
  description: "Review your recent orders, profile details, and quick links to manage your Jose Madrid Salsa account.",
  pathname: "/account",
});

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/account");
  }

  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      fundraiserAccount: {
        select: { id: true, status: true },
      },
    },
  });

  const recentOrdersRaw = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      total: true,
    },
  });

  const recentOrders = recentOrdersRaw.map(o => ({
    id: o.id,
    number: o.orderNumber ?? o.id.slice(-6).toUpperCase(),
    status: o.status,
    createdAt: o.createdAt,
    total: Number(o.total),
  }));

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {user?.role ? <p className="text-xs text-muted-foreground mt-1">Role: {user.role}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/account/orders">
              <Button variant="default">View Orders</Button>
            </Link>
            <Link href="/account/settings">
              <Button variant="secondary">Account Settings</Button>
            </Link>
            {(user?.role === UserRole.FUNDRAISER || user?.fundraiserAccount) && (
              <Link href="/fundraiser-portal/dashboard">
                <Button variant="default" className="bg-verde-600 hover:bg-verde-700 text-white">
                  Fundraising Portal →
                </Button>
              </Link>
            )}
            {(user?.role === UserRole.ADMIN || user?.role === UserRole.DEVELOPER || user?.role === UserRole.STAFF) && (
              <Link href="/admin">
                <Button variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50">
                  Admin Panel →
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="text-lg font-medium mb-4">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No orders yet. Visit the store to place your first order.
            </div>
          ) : (
            <div className="grid gap-3">
              {recentOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
          <div className="mt-4">
            <Link href="/account/orders" className="text-sm text-primary hover:underline">
              View all orders
            </Link>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
          <div className="grid gap-2">
            <Link href="/account/settings" className="text-sm hover:underline">Update profile</Link>
            <Link href="/account/settings" className="text-sm hover:underline">Manage addresses</Link>
            <Link href="/account/orders" className="text-sm hover:underline">Track an order</Link>
            {(user?.role === UserRole.FUNDRAISER || user?.fundraiserAccount) && (
              <Link href="/fundraiser-portal/dashboard" className="text-sm font-semibold text-verde-600 hover:underline">
                → Go to Fundraising Portal
              </Link>
            )}
            {!user?.fundraiserAccount && user?.role !== UserRole.FUNDRAISER && (
              <Link href="/auth/fundraiser-signup" className="text-sm text-muted-foreground hover:underline">
                Start a fundraiser
              </Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
