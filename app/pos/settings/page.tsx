'use client'

import { useState } from 'react'
import { Smartphone, Printer, Plus, Wifi, WifiOff, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface PairedDevice {
  id: string
  name: string
  model: string
  status: 'online' | 'offline'
  lastSeen: string
}

const PLACEHOLDER_DEVICES: PairedDevice[] = [
  {
    id: 'dev-1',
    name: 'Front Counter Terminal',
    model: 'Square Terminal',
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'dev-2',
    name: 'Farmers Market Terminal',
    model: 'Square Terminal',
    status: 'offline',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
]

const PRINTER_OPTIONS = [
  { value: '', label: 'No printer configured' },
  { value: 'star-tsp100', label: 'Star TSP100 (USB)' },
  { value: 'epson-tm-t20', label: 'Epson TM-T20III (USB)' },
  { value: 'star-sm-l200', label: 'Star SM-L200 (Bluetooth)' },
]

function formatLastSeen(isoString: string): string {
  const date = new Date(isoString)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function POSSettingsPage() {
  const [taxRate, setTaxRate] = useState('7.25')
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [taxSaved, setTaxSaved] = useState(false)

  function handleSaveTaxRate() {
    setTaxSaved(true)
    setTimeout(() => setTaxSaved(false), 2000)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">POS Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure terminals, tax rates, and receipt printing
          </p>
        </div>

        {/* Device Pairing Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">
                Paired Devices
              </h2>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Plus className="mr-1.5 h-4 w-4" />
              Pair New Device
            </Button>
          </div>

          <div className="space-y-3">
            {PLACEHOLDER_DEVICES.map((device) => (
              <Card key={device.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        device.status === 'online'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {device.status === 'online' ? (
                        <Wifi className="h-5 w-5" />
                      ) : (
                        <WifiOff className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {device.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {device.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge
                        className={
                          device.status === 'online'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-600'
                        }
                      >
                        {device.status === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatLastSeen(device.lastSeen)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {PLACEHOLDER_DEVICES.length === 0 && (
              <Card className="p-8">
                <div className="flex flex-col items-center text-center text-slate-400">
                  <Smartphone className="h-10 w-10 mb-3" />
                  <p className="font-medium text-slate-600">No devices paired</p>
                  <p className="mt-1 text-sm">
                    Pair a Square Terminal to accept card payments at point of sale
                  </p>
                </div>
              </Card>
            )}
          </div>
        </section>

        {/* Tax Rate Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              Default Tax Rate
            </h2>
          </div>

          <Card className="p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="tax-rate" className="text-sm text-slate-600">
                  Tax rate (%)
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="25"
                    value={taxRate}
                    onChange={(e) => {
                      setTaxRate(e.target.value)
                      setTaxSaved(false)
                    }}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    %
                  </span>
                </div>
              </div>
              <Button
                onClick={handleSaveTaxRate}
                size="sm"
                className="bg-salsa-500 hover:bg-salsa-600"
              >
                {taxSaved ? 'Saved' : 'Save'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Applied to all POS transactions. Override per-product tax rates in the product catalog.
            </p>
          </Card>
        </section>

        {/* Receipt Printer Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Printer className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              Receipt Printer
            </h2>
          </div>

          <Card className="p-4">
            <div className="max-w-[320px]">
              <Label htmlFor="printer-select" className="text-sm text-slate-600">
                Printer
              </Label>
              <select
                id="printer-select"
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-400 focus-visible:ring-offset-2"
              >
                {PRINTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Select a receipt printer connected to this device. Printer support requires the POS companion app.
            </p>
          </Card>
        </section>
      </div>
    </div>
  )
}
