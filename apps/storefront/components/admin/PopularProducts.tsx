import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

const heatLevelVariants: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  MILD: 'secondary',
  MEDIUM: 'secondary',
  HOT: 'default',
  EXTRA_HOT: 'destructive',
  FRUIT: 'outline',
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
      <Card>
        <CardHeader>
          <CardTitle>Popular Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 bg-muted rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Popular Products</CardTitle>
        <p className="text-sm text-muted-foreground">Top 10 best-selling products</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Heat Level</TableHead>
              <TableHead className="text-right">Units Sold</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No product data available
                </TableCell>
              </TableRow>
            ) : (
              products.slice(0, 10).map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
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
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                          N/A
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.heatLevel && (
                      <Badge variant={heatLevelVariants[product.heatLevel] ?? 'outline'}>
                        {product.heatLevel.replace('_', ' ')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {product.totalSold.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {formatCurrency(product.revenue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
