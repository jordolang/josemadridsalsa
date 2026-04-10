'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { InventoryAlertType } from '@prisma/client';

interface InventoryAlert {
  id: string;
  type: InventoryAlertType;
  stockLevel: number;
  threshold: number;
  createdAt: Date;
  product: {
    id: string;
    name: string;
    sku: string;
    inventory: number;
    category: {
      name: string;
    };
  };
}

interface InventoryAlertsTableProps {
  alerts: InventoryAlert[];
  canWrite: boolean;
}

export function InventoryAlertsTable({ alerts, canWrite }: InventoryAlertsTableProps) {
  const router = useRouter();
  const [loadingAlertId, setLoadingAlertId] = useState<string | null>(null);

  const handleAlertAction = async (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => {
    setLoadingAlertId(alertId);

    try {
      const response = await fetch(`/api/admin/inventory/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${action} alert`);
      }

      toast.success('Alert updated', {
        description: data.message,
      });

      router.refresh();
    } catch (error: any) {
      toast.error('Error', {
        description: error.message,
      });
    } finally {
      setLoadingAlertId(null);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No active alerts</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Alert Type</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Created</TableHead>
            {canWrite && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/admin/products/${alert.product.id}`}
                  className="hover:underline"
                >
                  {alert.product.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-sm">{alert.product.sku}</TableCell>
              <TableCell>{alert.product.category.name}</TableCell>
              <TableCell>
                {alert.type === InventoryAlertType.OUT_OF_STOCK ? (
                  <Badge variant="destructive">Out of Stock</Badge>
                ) : (
                  <Badge variant="warning">Low Stock</Badge>
                )}
              </TableCell>
              <TableCell>
                <span
                  className={
                    alert.product.inventory === 0
                      ? 'font-medium text-destructive'
                      : 'font-medium text-amber-600 dark:text-amber-400'
                  }
                >
                  {alert.product.inventory}
                </span>
              </TableCell>
              <TableCell>{alert.threshold}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(alert.createdAt).toLocaleDateString()}
              </TableCell>
              {canWrite && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                      disabled={loadingAlertId === alert.id}
                      aria-label="Acknowledge alert"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAlertAction(alert.id, 'resolve')}
                      disabled={loadingAlertId === alert.id}
                      aria-label="Resolve alert"
                    >
                      <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAlertAction(alert.id, 'dismiss')}
                      disabled={loadingAlertId === alert.id}
                      aria-label="Dismiss alert"
                    >
                      <XCircle className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
