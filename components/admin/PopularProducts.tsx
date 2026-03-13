import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PopularProduct {
  id: string
  name: string
  sku: string
  imageUrl?: string | null
  totalSold: number
  revenue: number
  heatLevel?: string | null
}

interface PopularProductsProps {
  products: PopularProduct[]
  loading?: boolean
}

const heatLevelColors: Record<string, string> = {
  MILD: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HOT: 'bg-orange-100 text-orange-800',
  EXTRA_HOT: 'bg-red-100 text-red-800',
  FRUIT: 'bg-purple-100 text-purple-800',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function PopularProducts({ products, loading }: PopularProductsProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 bg-slate-200 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-20 bg-slate-200 rounded" />
              </div>
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-slate-900">Popular Products</h3>
      <p className="mt-1 text-sm text-slate-600">Top 10 best-selling products</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-600">
              <th className="pb-3 font-medium">#</th>
              <th className="pb-3 font-medium">Product</th>
              <th className="pb-3 font-medium">Heat Level</th>
              <th className="pb-3 text-right font-medium">Units Sold</th>
              <th className="pb-3 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No product data available
                </td>
              </tr>
            ) : (
              products.slice(0, 10).map((product, index) => (
                <tr key={product.id} className="border-b last:border-0">
                  <td className="py-3 text-slate-500">{index + 1}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                          N/A
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    {product.heatLevel && (
                      <Badge
                        className={
                          heatLevelColors[product.heatLevel] || 'bg-slate-100 text-slate-800'
                        }
                      >
                        {product.heatLevel.replace('_', ' ')}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 text-right text-slate-900">
                    {product.totalSold.toLocaleString()}
                  </td>
                  <td className="py-3 text-right font-medium text-slate-900">
                    {formatCurrency(product.revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
