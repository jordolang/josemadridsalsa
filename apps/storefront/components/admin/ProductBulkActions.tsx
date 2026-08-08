'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BulkProductAction } from '@/lib/admin/bulk-products'

/**
 * Both money fields take the same shape, but not the same floor: the API rejects a price of
 * zero because nothing in the catalogue is free, while a cost of zero is legitimate — donated
 * stock costs nothing.
 */
function isAmount(value: string, min: number): boolean {
  const amount = Number(value)
  return value.trim() !== '' && !Number.isNaN(amount) && amount >= min
}

/**
 * Actions bar for a product selection. Rendered only when something is selected, so it
 * never occupies space while browsing.
 */
export function ProductBulkActions({
  selectedIds,
  categories,
  onDone,
}: {
  selectedIds: string[]
  categories: { id: string; name: string }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [percent, setPercent] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')

  if (selectedIds.length === 0) return null

  async function run(operation: BulkProductAction) {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedIds, operation }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Bulk update failed')
        return
      }
      toast.success(data.summary ?? 'Updated')
      onDone()
      router.refresh()
    } catch {
      toast.error('Bulk update failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
      <span className="text-sm font-medium">
        {selectedIds.length} selected
      </span>

      <Button size="sm" variant="outline" disabled={isSaving} onClick={() => run({ action: 'activate' })}>
        Activate
      </Button>
      <Button size="sm" variant="outline" disabled={isSaving} onClick={() => run({ action: 'deactivate' })}>
        Deactivate
      </Button>
      <Button size="sm" variant="outline" disabled={isSaving} onClick={() => run({ action: 'feature' })}>
        Feature
      </Button>
      <Button size="sm" variant="outline" disabled={isSaving} onClick={() => run({ action: 'unfeature' })}>
        Unfeature
      </Button>

      <Select
        disabled={isSaving}
        onValueChange={(categoryId) => run({ action: 'assign-category', categoryId })}
      >
        <SelectTrigger className="h-8 w-44" aria-label="Move to category">
          <SelectValue placeholder="Move to category…" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          placeholder="±%"
          className="h-8 w-20"
          aria-label="Price adjustment percent"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isSaving || percent.trim() === '' || Number.isNaN(Number(percent))}
          onClick={() => run({ action: 'adjust-price', percent: Number(percent) })}
        >
          Adjust price
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="$"
          className="h-8 w-20"
          aria-label="Price"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isSaving || !isAmount(price, 0.01)}
          onClick={() => run({ action: 'set-price', price: Number(price) })}
        >
          Set price
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="$"
          className="h-8 w-20"
          aria-label="Cost"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isSaving || !isAmount(cost, 0)}
          onClick={() => run({ action: 'set-cost', cost: Number(cost) })}
        >
          Set cost
        </Button>
      </div>

      <Button
        size="sm"
        variant="outline"
        disabled={isSaving}
        onClick={() => run({ action: 'apply-latest-purchase-cost' })}
      >
        Cost from purchases
      </Button>

      <Button size="sm" variant="ghost" disabled={isSaving} onClick={onDone} className="ml-auto">
        Clear
      </Button>
    </div>
  )
}
