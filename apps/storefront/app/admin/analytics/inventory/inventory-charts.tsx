'use client'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface TransactionByType {
  type: string
  count: number
  quantity: number
}

interface InventoryByCategory {
  category: string
  totalUnits: number
  totalValue: number
  productCount: number
}

interface InventoryChartsProps {
  transactionsByType: TransactionByType[]
  inventoryByCategory: InventoryByCategory[]
}

const chartConfig = {
  count: { label: 'Transactions', color: 'hsl(var(--chart-1))' },
}

const categoryChartConfig = {
  totalValue: { label: 'Inventory Value', color: 'hsl(var(--chart-2))' },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function InventoryCharts({ transactionsByType, inventoryByCategory }: InventoryChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        {transactionsByType.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={transactionsByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tickFormatter={(v) => v.substring(0, 3)} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No transaction data available
          </div>
        )}
      </div>

      <div>
        {inventoryByCategory.length > 0 ? (
          <ChartContainer config={categoryChartConfig} className="h-[300px]">
            <BarChart data={inventoryByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tickFormatter={(v) => v.substring(0, 10)} />
              <YAxis />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Bar dataKey="totalValue" fill="var(--color-totalValue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No category data available
          </div>
        )}
      </div>
    </div>
  )
}
