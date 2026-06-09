import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPrice } from '@/lib/utils'

interface TopProduct {
  productId: string
  name: string
  orders: number
  quantity: number
  revenue: number
  sku: string
  imageUrl: string | null
  heatLevel: string | null
}

interface TopProductsTableProps {
  products: TopProduct[]
}

export function TopProductsTable({ products }: TopProductsTableProps) {
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Top Products Detail</h2>
          <p className="text-sm text-muted-foreground">Based on revenue for this range</p>
        </div>
        {products.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {formatPrice(totalRevenue)} total
          </span>
        )}
      </div>
      {products.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No product sales recorded in this range.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.productId}>
                  <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                  <TableCell className="text-right text-foreground">
                    {product.orders.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {product.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {formatPrice(product.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}
