'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TopProduct {
  name: string
  sold: number
  revenue: number
  trend: number
  image?: string
}

interface TopProductsTableProps {
  products?: TopProduct[]
}

const defaultProducts: TopProduct[] = [
  { name: 'Ghost Pepper Salsa', sold: 234, revenue: 2808, trend: 12.5 },
  { name: 'Mango Habanero', sold: 198, revenue: 2376, trend: 8.2 },
  { name: 'Original Recipe', sold: 176, revenue: 1760, trend: -2.1 },
  { name: 'Smoky Chipotle', sold: 145, revenue: 1595, trend: 15.7 },
  { name: 'Carolina Reaper', sold: 89, revenue: 1246, trend: 22.3 },
]

export function TopProductsTable({ products = defaultProducts }: TopProductsTableProps) {
  const maxSold = Math.max(...products.map((p) => p.sold))

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Top Products</CardTitle>
          <span className="text-xs text-muted-foreground">By units sold</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.map((product, index) => (
            <div key={product.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.sold} units
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    ${product.revenue.toLocaleString()}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      product.trend >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}
                  >
                    {product.trend >= 0 ? '+' : ''}
                    {product.trend}%
                  </p>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${(product.sold / maxSold) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
