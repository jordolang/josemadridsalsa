import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Order History",
  description: "Your past orders",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    PROCESSING: "bg-indigo-100 text-indigo-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    REFUNDED: "bg-gray-200 text-gray-800",
  };
  return <Badge className={styles[status] ?? "bg-gray-100 text-gray-800"}>{status}</Badge>;
}

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/account/orders");
  }
  const userId = (session.user as any).id;

  const ordersRaw = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      total: true,
    },
  });

  const orders = ordersRaw.map(o => ({
    id: o.id,
    number: o.orderNumber ?? o.id.slice(-6).toUpperCase(),
    createdAt: o.createdAt,
    status: o.status,
    total: Number(o.total),
  }));

  return (
    <Card className="p-4">
      <h1 className="text-xl font-semibold mb-4">Order History</h1>
      {orders.length === 0 ? (
        <div className="text-sm text-muted-foreground">You have no orders yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="py-2 pr-4">
                    <Link href={`/account/orders/${o.id}`} className="hover:underline">
                      #{o.number}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{o.createdAt.toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-2 pr-0 text-right">{formatCurrency(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
