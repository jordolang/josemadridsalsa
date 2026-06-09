import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type OrderSummary = {
  id: string;
  number: string;
  status: string;
  createdAt: Date;
  total: number;
};

type Props = { order: OrderSummary };

function formatCurrency(v: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v);
}

export function OrderCard({ order }: Props) {
  return (
    <Card className="p-4 flex items-center justify-between">
      <div>
        <div className="font-medium">Order #{order.number}</div>
        <div className="text-xs text-muted-foreground">{order.createdAt.toLocaleString()}</div>
      </div>
      <div className="flex items-center gap-3">
        <Badge>{order.status}</Badge>
        <div className="text-sm font-medium">{formatCurrency(order.total)}</div>
        <Link href={`/account/orders/${order.id}`} className="text-sm text-primary hover:underline">
          View
        </Link>
      </div>
    </Card>
  );
}
