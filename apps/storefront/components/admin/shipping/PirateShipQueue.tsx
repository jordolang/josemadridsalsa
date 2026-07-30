'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Download, Ship, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface QueueRow {
  id: string
  orderNumber: string
  createdAt: string
  customerName: string
  destination: string | null
  itemCount: number
  hasAddress: boolean
}

interface PirateShipQueueProps {
  rows: QueueRow[]
  canExport: boolean
  canWrite: boolean
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function PirateShipQueue({ rows, canExport, canWrite }: PirateShipQueueProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const shippable = useMemo(() => rows.filter((r) => r.hasAddress), [rows])
  const allSelected = shippable.length > 0 && selected.size === shippable.length

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(shippable.map((r) => r.id)))
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportSelected = () => {
    if (selected.size === 0) return
    const ids = [...selected].join(',')
    const date = new Date().toISOString().split('T')[0]
    triggerDownload(
      `/api/admin/shipping/pirate-ship/export?ids=${encodeURIComponent(ids)}`,
      `pirateship-batch-${date}.csv`
    )
    toast.success(`Exported ${selected.size} order(s)`, {
      description: 'Drag the file into pirateship.com, then buy & print labels.',
    })
  }

  const exportAll = () => {
    const date = new Date().toISOString().split('T')[0]
    triggerDownload(
      '/api/admin/shipping/pirate-ship/export',
      `pirateship-batch-${date}.csv`
    )
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/admin/shipping/pirate-ship/import-tracking', {
        method: 'POST',
        body,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')

      const notFound = data.notFound?.length
        ? ` ${data.notFound.length} order(s) not matched.`
        : ''
      toast.success('Tracking imported', {
        description: `${data.updated} marked shipped, ${data.alreadyShipped} already shipped.${notFound}`,
      })
      router.refresh()
    } catch (err: any) {
      toast.error('Import failed', { description: err.message })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={exportSelected} disabled={!canExport || selected.size === 0}>
          <Ship className="mr-2 size-4" />
          Export selected ({selected.size})
        </Button>
        <Button variant="outline" onClick={exportAll} disabled={!canExport || shippable.length === 0}>
          <Download className="mr-2 size-4" />
          Export all unshipped
        </Button>
        {canWrite && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImport(file)
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="mr-2 size-4" />
              {importing ? 'Importing…' : 'Import tracking CSV'}
            </Button>
          </>
        )}
      </div>

      {!canExport && (
        <Alert>
          <AlertDescription>
            You don&apos;t have export permission, so downloads are disabled.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Unshipped paid orders ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No orders are waiting to ship.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggleOne(row.id)}
                        disabled={!row.hasAddress}
                        aria-label={`Select ${row.orderNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/orders/${row.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>
                      {row.hasAddress ? (
                        row.destination
                      ) : (
                        <Badge variant="destructive">No address</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{row.itemCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
