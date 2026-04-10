'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface InventoryItem {
  name: string
  sku: string
  stock: number
  threshold: number
}

interface InventoryAlertWidgetProps {
  items?: InventoryItem[]
}

export function InventoryAlertWidget({ items }: InventoryAlertWidgetProps) {
  if (!items || items.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Inventory Alerts</CardTitle>
            <Link
              href="/admin/inventory"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">All stock levels healthy</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Inventory Alerts</CardTitle>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-xs font-bold text-destructive">
              {items.length}
            </span>
          </div>
          <Link
            href="/admin/inventory"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => {
            const percentage = (item.stock / item.threshold) * 100
            const isCritical = percentage <= 30
            return (
              <div
                key={item.sku}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                  </div>
                  {isCritical && (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isCritical ? 'bg-destructive' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isCritical ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {item.stock} left
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
