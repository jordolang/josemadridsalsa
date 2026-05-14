import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getBarWidth } from '@/lib/analytics/chart-utils'
import { formatPrice } from '@/lib/utils'

interface ChartPoint {
  date: string
  label: string
  orders: number
  revenue: number
}

interface RevenueOrdersTableProps {
  data: ChartPoint[]
}

export function RevenueOrdersTable({ data }: RevenueOrdersTableProps) {
  const maxOrders = data.reduce((max, point) => Math.max(max, point.orders), 0)
  const maxRevenue = data.reduce((max, point) => Math.max(max, point.revenue), 0)

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Revenue & Orders</h2>
          <p className="text-sm text-muted-foreground">Daily trends for the selected range</p>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No order activity recorded for this range.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((point) => (
                <TableRow key={point.date}>
                  <TableCell className="text-foreground">{point.label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-32 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: getBarWidth(point.orders, maxOrders) }}
                        />
                      </div>
                      <span className="font-medium text-foreground">{point.orders}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-32 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: getBarWidth(point.revenue, maxRevenue) }}
                        />
                      </div>
                      <span className="font-medium text-foreground">
                        {formatPrice(point.revenue)}
                      </span>
                    </div>
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
