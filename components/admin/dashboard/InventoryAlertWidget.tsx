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

const defaultItems: InventoryItem[] = [
  { name: 'Ghost Pepper Salsa 8oz', sku: 'GPS-8', stock: 3, threshold: 10 },
  { name: 'Mango Habanero 16oz', sku: 'MH-16', stock: 5, threshold: 10 },
  { name: 'Carolina Reaper 8oz', sku: 'CR-8', stock: 2, threshold: 5 },
  { name: 'Original Recipe 32oz', sku: 'OR-32', stock: 7, threshold: 15 },
]

export function InventoryAlertWidget({ items = defaultItems }: InventoryAlertWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Inventory Alerts</CardTitle>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
              {items.length}
            </span>
          </div>
          <Link
            href="/admin/inventory"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
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
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isCritical ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isCritical ? 'text-red-600' : 'text-amber-600'
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
