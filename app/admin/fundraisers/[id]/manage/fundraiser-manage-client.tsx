'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  DollarSign, TrendingUp, Users, Package, Save,
  ExternalLink, CheckCircle, XCircle, Loader2
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { FundraiserStatus, FundraiserParticipantStatus } from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductBase {
  id: string
  name: string
  sku: string
  price: string | number
  featuredImage: string | null
  isActive: boolean
}

interface FundraiserProductRecord {
  id: string
  productId: string
  price: string | number | null
  isActive: boolean
  product: ProductBase
}

interface ParticipantRecord {
  id: string
  name: string
  email: string
  referralCode: string
  totalRevenue: string | number
  totalOrders: number
  status: FundraiserParticipantStatus
}

interface OrderRecord {
  id: string
  orderNumber: string
  status: string
  total: string | number
  createdAt: string
  participant: { name: string } | null
}

interface FundraiserData {
  id: string
  name: string
  slug: string
  organizationName: string
  contactEmail: string
  contactPhone: string | null
  startDate: string
  endDate: string
  goal: string | number | null
  commissionRate: string | number
  status: FundraiserStatus
  isActive: boolean
  totalOrders: number
  totalRevenue: string | number
  totalCommission: string | number
  subdomain: string | null
  logoUrl: string | null
  coverPhotoUrl: string | null
  missionStatement: string | null
  bio: string | null
  pageConfig: Record<string, unknown> | null
  products: FundraiserProductRecord[]
  participants: ParticipantRecord[]
  orders: OrderRecord[]
}

interface AllProduct extends ProductBase {}

interface Props {
  fundraiser: FundraiserData
  allProducts: AllProduct[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(val: string | number | null | undefined, decimals = 2) {
  if (val === null || val === undefined) return '—'
  return Number(val).toFixed(decimals)
}

function toDateInput(iso: string) {
  return iso.slice(0, 10)
}

const STATUS_COLORS: Record<FundraiserStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-800',
  ACTIVE: 'bg-green-100 text-green-800',
  ENDED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ fundraiser }: { fundraiser: FundraiserData }) {
  const [form, setForm] = useState({
    name: fundraiser.name,
    organizationName: fundraiser.organizationName,
    contactEmail: fundraiser.contactEmail,
    contactPhone: fundraiser.contactPhone ?? '',
    startDate: toDateInput(fundraiser.startDate),
    endDate: toDateInput(fundraiser.endDate),
    status: fundraiser.status,
    isActive: fundraiser.isActive,
    goal: fundraiser.goal !== null ? String(Number(fundraiser.goal)) : '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/fundraisers/${fundraiser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          organizationName: form.organizationName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || null,
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.status,
          isActive: form.isActive,
          goal: form.goal ? Number(form.goal) : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${fmt(fundraiser.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Commission</p>
                <p className="text-2xl font-bold">${fmt(fundraiser.totalCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{fundraiser.totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Form */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name</Label>
              <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="org">Organization Name</Label>
              <Input id="org" value={form.organizationName} onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="goal">Goal Amount ($)</Label>
              <Input id="goal" type="number" min="0" step="0.01" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder="No goal set" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as FundraiserStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ENDED">Ended</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="isActive" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="isActive">Portal Active (visible to public)</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Contact Email</Label>
              <Input id="email" type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="phone">Contact Phone</Label>
              <Input id="phone" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="Optional" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Overview
        </Button>
        {saved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Saved!</span>}
      </div>
    </form>
  )
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

interface ProductSelection {
  included: boolean
  price: string
  isActive: boolean
}

function ProductsTab({ fundraiser, allProducts }: { fundraiser: FundraiserData; allProducts: AllProduct[] }) {
  // Build initial state from existing FundraiserProduct records
  const initialSelections = useCallback((): Record<string, ProductSelection> => {
    const map: Record<string, ProductSelection> = {}
    allProducts.forEach(p => {
      const fp = fundraiser.products.find(fp => fp.productId === p.id)
      map[p.id] = {
        included: !!fp,
        price: fp?.price !== null && fp?.price !== undefined ? String(Number(fp.price)) : '',
        isActive: fp?.isActive ?? true,
      }
    })
    return map
  }, [fundraiser.products, allProducts])

  const [selections, setSelections] = useState<Record<string, ProductSelection>>(initialSelections)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const toggleIncluded = (productId: string) => {
    setSelections(prev => ({
      ...prev,
      [productId]: { ...prev[productId], included: !prev[productId].included },
    }))
  }

  const setPrice = (productId: string, price: string) => {
    setSelections(prev => ({ ...prev, [productId]: { ...prev[productId], price } }))
  }

  const setIsActive = (productId: string, isActive: boolean) => {
    setSelections(prev => ({ ...prev, [productId]: { ...prev[productId], isActive } }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const sels = Object.entries(selections).map(([productId, sel]) => ({
        productId,
        included: sel.included,
        price: sel.included && sel.price ? Number(sel.price) : null,
        isActive: sel.included ? sel.isActive : true,
      }))

      const res = await fetch(`/api/admin/fundraisers/${fundraiser.id}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections: sels }),
      })

      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to save')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const includedCount = Object.values(selections).filter(s => s.included).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Product Selection</h3>
          <p className="text-sm text-muted-foreground">{includedCount} of {allProducts.length} products included in this fundraiser</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
          {saved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" />Saved!</span>}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {filteredProducts.map(product => {
          const sel = selections[product.id]
          if (!sel) return null
          return (
            <Card key={product.id} className={`transition-colors ${sel.included ? 'border-green-300 bg-green-50/30 dark:bg-green-950/10' : ''}`}>
              <CardContent className="flex items-center gap-4 py-3">
                {/* Image */}
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border bg-slate-100">
                  {product.featuredImage ? (
                    <Image src={product.featuredImage} alt={product.name} width={56} height={56} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-muted-foreground">SKU: {product.sku} · Base price: ${fmt(product.price)}</p>
                </div>

                {/* Include toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={sel.included}
                    onCheckedChange={() => toggleIncluded(product.id)}
                    id={`include-${product.id}`}
                  />
                  <Label htmlFor={`include-${product.id}`} className="text-sm cursor-pointer">
                    {sel.included ? 'Included' : 'Excluded'}
                  </Label>
                </div>

                {/* Custom price (only if included) */}
                {sel.included && (
                  <>
                    <div className="flex items-center gap-2 w-40">
                      <Label className="text-sm whitespace-nowrap">Custom price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={sel.price}
                        onChange={e => setPrice(product.id, e.target.value)}
                        placeholder={fmt(product.price)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={sel.isActive}
                        onCheckedChange={v => setIsActive(product.id, v)}
                        id={`active-${product.id}`}
                      />
                      <Label htmlFor={`active-${product.id}`} className="text-sm">Active</Label>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Commission Tab ───────────────────────────────────────────────────────────

function CommissionTab({ fundraiser, allProducts }: { fundraiser: FundraiserData; allProducts: AllProduct[] }) {
  const [commissionRate, setCommissionRate] = useState(String(Number(fundraiser.commissionRate)))
  const [markupPct, setMarkupPct] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkSaved, setBulkSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rate = Number(commissionRate) || 0
  const sampleRevenue = 1000
  const sampleCommission = (sampleRevenue * rate) / 100

  const handleSaveCommission = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/fundraisers/${fundraiser.id}/commission`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionRate: Number(commissionRate) }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkMarkup = async () => {
    if (!markupPct) return
    const markup = Number(markupPct) / 100
    setBulkSaving(true)
    setError(null)
    try {
      // Build selections: apply markup to all included products
      const includedProductIds = fundraiser.products.map(fp => fp.productId)
      const selections = allProducts
        .filter(p => includedProductIds.includes(p.id))
        .map(p => ({
          productId: p.id,
          included: true,
          price: Number(Number(p.price) * (1 + markup)).toFixed(2),
          isActive: fundraiser.products.find(fp => fp.productId === p.id)?.isActive ?? true,
        }))

      const res = await fetch(`/api/admin/fundraisers/${fundraiser.id}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to apply markup')
      }
      setBulkSaved(true)
      setTimeout(() => setBulkSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error applying markup')
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Commission Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Rate</CardTitle>
            <CardDescription>Percentage of revenue earned by the fundraiser organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="commissionRate">Commission Rate (%)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="commissionRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">Commission Preview</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Sample revenue</span>
                  <span>${sampleRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission ({rate}%)</span>
                  <span className="font-semibold text-green-600">${sampleCommission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current total commission earned</span>
                  <span className="font-semibold">${fmt(fundraiser.totalCommission)}</span>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3">
              <Button onClick={handleSaveCommission} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Commission Rate
              </Button>
              {saved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" />Saved!</span>}
            </div>
          </CardContent>
        </Card>

        {/* Bulk Price Markup */}
        <Card>
          <CardHeader>
            <CardTitle>Bulk Price Adjustment</CardTitle>
            <CardDescription>Apply a percentage markup over base price to all included products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="markupPct">Markup Percentage (%)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="markupPct"
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={markupPct}
                  onChange={e => setMarkupPct(e.target.value)}
                  className="w-32"
                  placeholder="e.g. 20"
                />
                <span className="text-sm text-muted-foreground">% over base</span>
              </div>
            </div>

            {markupPct && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm font-medium">Price Preview (sample $10.00 base)</p>
                <div className="flex justify-between text-sm">
                  <span>With {markupPct}% markup</span>
                  <span className="font-semibold">${(10 * (1 + Number(markupPct) / 100)).toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Will update {fundraiser.products.length} included products
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleBulkMarkup} disabled={bulkSaving || !markupPct} variant="outline">
                {bulkSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                Apply Bulk Markup
              </Button>
              {bulkSaved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" />Applied!</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Branding Tab ─────────────────────────────────────────────────────────────

function BrandingTab({ fundraiser }: { fundraiser: FundraiserData }) {
  const [form, setForm] = useState({
    subdomain: fundraiser.subdomain ?? '',
    logoUrl: fundraiser.logoUrl ?? '',
    coverPhotoUrl: fundraiser.coverPhotoUrl ?? '',
    missionStatement: fundraiser.missionStatement ?? '',
    bio: fundraiser.bio ?? '',
    pageConfig: fundraiser.pageConfig ? JSON.stringify(fundraiser.pageConfig, null, 2) : '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    let pageConfig: Record<string, unknown> | null = null
    if (form.pageConfig.trim()) {
      try {
        pageConfig = JSON.parse(form.pageConfig)
      } catch {
        setError('Invalid JSON in Page Config')
        setSaving(false)
        return
      }
    }

    try {
      const res = await fetch(`/api/admin/fundraisers/${fundraiser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain: form.subdomain || null,
          logoUrl: form.logoUrl || null,
          coverPhotoUrl: form.coverPhotoUrl || null,
          missionStatement: form.missionStatement || null,
          bio: form.bio || null,
          pageConfig,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const publicUrl = `/fundraisers/${fundraiser.slug}`

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Portal Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subdomain">Subdomain (URL slug)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="subdomain"
                  value={form.subdomain}
                  onChange={e => setForm(f => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="my-school"
                  className="flex-1"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Used for custom subdomain access (e.g., my-school.josemadridsalsa.com)</p>
            </div>
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
              {form.logoUrl && (
                <div className="mt-2 h-16 w-16 overflow-hidden rounded border">
                  <img src={form.logoUrl} alt="Logo preview" className="h-full w-full object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="coverPhotoUrl">Cover Photo URL</Label>
              <Input id="coverPhotoUrl" value={form.coverPhotoUrl} onChange={e => setForm(f => ({ ...f, coverPhotoUrl: e.target.value }))} placeholder="https://..." />
              {form.coverPhotoUrl && (
                <div className="mt-2 h-24 w-full overflow-hidden rounded border">
                  <img src={form.coverPhotoUrl} alt="Cover preview" className="h-full w-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="missionStatement">Mission Statement</Label>
              <Textarea
                id="missionStatement"
                value={form.missionStatement}
                onChange={e => setForm(f => ({ ...f, missionStatement: e.target.value }))}
                rows={4}
                placeholder="Share the organization's mission..."
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio / About</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={4}
                placeholder="Tell supporters about your organization..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Configuration (JSON)</CardTitle>
          <CardDescription>Advanced theme colors and layout settings in JSON format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={form.pageConfig}
            onChange={e => setForm(f => ({ ...f, pageConfig: e.target.value }))}
            rows={8}
            className="font-mono text-sm"
            placeholder='{"primaryColor": "#22c55e", "layout": "hero"}'
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Branding
        </Button>
        {saved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" />Saved!</span>}
        <Button type="button" variant="outline" asChild>
          <Link href={publicUrl} target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            Preview Public Page
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}

// ─── Participants Tab ─────────────────────────────────────────────────────────

function ParticipantsTab({ fundraiser }: { fundraiser: FundraiserData }) {
  const [participants, setParticipants] = useState(fundraiser.participants)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateStatus = async (participantId: string, status: FundraiserParticipantStatus) => {
    setLoading(participantId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/fundraisers/${fundraiser.id}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, status }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to update')
      }
      setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, status } : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating participant')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Participants</h3>
          <p className="text-sm text-muted-foreground">{participants.length} total participants</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/fundraisers/${fundraiser.id}/participants`}>
            <Users className="mr-2 h-4 w-4" />
            Full Participant Manager
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {participants.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p>No participants yet</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {participants.map(p => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.email}</p>
                  <p className="text-xs text-muted-foreground font-mono">Code: {p.referralCode}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">${fmt(p.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">{p.totalOrders} orders</p>
                </div>
                <Badge className={p.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                  {p.status}
                </Badge>
                <div className="flex gap-2">
                  {p.status === 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading === p.id}
                      onClick={() => updateStatus(p.id, 'INACTIVE')}
                    >
                      {loading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading === p.id}
                      onClick={() => updateStatus(p.id, 'ACTIVE')}
                    >
                      {loading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                      Activate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
}

function OrdersTab({ fundraiser }: { fundraiser: FundraiserData }) {
  const { orders } = fundraiser

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Orders</h3>
          <p className="text-sm text-muted-foreground">{orders.length} most recent orders shown</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/orders?fundraiserId=${fundraiser.id}`}>
            View All in Orders
          </Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Package className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p>No orders yet</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <Card key={order.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">#{order.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.participant ? `By ${order.participant.name}` : 'Direct order'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className="font-semibold">${fmt(order.total)}</p>
                <Badge className={ORDER_STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-800'}>
                  {order.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function FundraiserManageClient({ fundraiser, allProducts }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{fundraiser.name}</h1>
            <Badge className={STATUS_COLORS[fundraiser.status]}>{fundraiser.status}</Badge>
            {fundraiser.isActive && <Badge className="bg-green-500 text-white">Portal Active</Badge>}
          </div>
          <p className="mt-1 text-muted-foreground">{fundraiser.organizationName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/fundraisers/${fundraiser.slug}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Public Page
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/fundraisers/${fundraiser.id}`}>← Back to Detail</Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">
            Products
            <span className="ml-1.5 rounded-full bg-green-100 text-green-800 px-1.5 py-0.5 text-xs font-medium">
              {fundraiser.products.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="commission">Commission &amp; Pricing</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="participants">
            Participants
            <span className="ml-1.5 rounded-full bg-blue-100 text-blue-800 px-1.5 py-0.5 text-xs font-medium">
              {fundraiser.participants.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="orders">
            Orders
            <span className="ml-1.5 rounded-full bg-purple-100 text-purple-800 px-1.5 py-0.5 text-xs font-medium">
              {fundraiser.totalOrders}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab fundraiser={fundraiser} />
        </TabsContent>

        <TabsContent value="products">
          <ProductsTab fundraiser={fundraiser} allProducts={allProducts} />
        </TabsContent>

        <TabsContent value="commission">
          <CommissionTab fundraiser={fundraiser} allProducts={allProducts} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingTab fundraiser={fundraiser} />
        </TabsContent>

        <TabsContent value="participants">
          <ParticipantsTab fundraiser={fundraiser} />
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab fundraiser={fundraiser} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
