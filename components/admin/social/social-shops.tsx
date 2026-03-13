'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Facebook,
  Music2,
  ShoppingBag,
  Store,
  Package,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  ArrowUpDown,
  Upload,
  X,
  Settings2,
} from 'lucide-react'
import type { ShopPlatform, ShopListingStatus } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ShopListingInfo, SocialAccountInfo } from '@/types/social'
import { SHOP_PLATFORM_CONFIG } from '@/types/social'

const STATUS_CONFIG: Record<ShopListingStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-slate-100 text-slate-600' },
  SYNCING: { label: 'Syncing', icon: Loader2, className: 'bg-blue-100 text-blue-700' },
  ACTIVE: { label: 'Active', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  PAUSED: { label: 'Paused', icon: Clock, className: 'bg-amber-100 text-amber-700' },
  REJECTED: { label: 'Rejected', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
  ERROR: { label: 'Error', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
}

const SHOP_ICONS: Record<ShopPlatform, React.ElementType> = {
  FACEBOOK_SHOP: ShoppingBag,
  FACEBOOK_MARKETPLACE: Store,
  TIKTOK_SHOP: Music2,
}

type Props = {
  accounts: SocialAccountInfo[]
}

export function SocialShops({ accounts }: Props) {
  const [listings, setListings] = useState<ShopListingInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [bulkSyncing, setBulkSyncing] = useState<ShopPlatform | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [filterPlatform, setFilterPlatform] = useState<ShopPlatform | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ShopListingStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addPlatform, setAddPlatform] = useState<ShopPlatform>('FACEBOOK_SHOP')
  const [catalogId, setCatalogId] = useState('')
  const [availableProducts, setAvailableProducts] = useState<Array<{ id: string; name: string; sku: string; price: string; image: string | null }>>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [loadingProducts, setLoadingProducts] = useState(false)

  const hasFacebook = accounts.some((a) => a.platform === 'FACEBOOK')
  const hasTikTok = accounts.some((a) => a.platform === 'TIKTOK')

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const url = filterPlatform === 'all'
        ? '/api/social/shops'
        : `/api/social/shops?platform=${filterPlatform}`
      const res = await fetch(url)
      const data = await res.json()
      setListings(data.listings || [])
    } catch {
      setError('Failed to load shop listings.')
    }
    setLoading(false)
  }, [filterPlatform])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch('/api/products?active=true&limit=200')
      const data = await res.json()
      const products = (data.products || data || []).map((p: { id: string; name: string; sku: string; price: string | number; featuredImage?: string | null; images?: string[] }) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: typeof p.price === 'number' ? p.price.toFixed(2) : p.price,
        image: p.featuredImage || (p.images && p.images[0]) || null,
      }))
      // Filter out products already listed on the selected platform
      const existingIds = new Set(
        listings.filter((l) => l.shopPlatform === addPlatform).map((l) => l.productId),
      )
      setAvailableProducts(products.filter((p: { id: string }) => !existingIds.has(p.id)))
    } catch {
      setAvailableProducts([])
    }
    setLoadingProducts(false)
  }

  const handleAddProducts = async () => {
    if (selectedProducts.size === 0) return
    setError(null)
    try {
      const res = await fetch('/api/social/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_create',
          productIds: Array.from(selectedProducts),
          shopPlatform: addPlatform,
          catalogId: catalogId || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSuccessMsg(`Added ${data.created} product${data.created !== 1 ? 's' : ''} to ${SHOP_PLATFORM_CONFIG[addPlatform].label}`)
        setShowAddPanel(false)
        setSelectedProducts(new Set())
        setTimeout(() => setSuccessMsg(null), 4000)
        fetchListings()
      }
    } catch {
      setError('Failed to add products.')
    }
  }

  const handleSync = async (listingId: string) => {
    setSyncing(listingId)
    setError(null)
    try {
      const res = await fetch('/api/social/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_listing', listingId }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Sync failed')
      } else {
        setSuccessMsg('Listing synced successfully')
        setTimeout(() => setSuccessMsg(null), 3000)
      }
      fetchListings()
    } catch {
      setError('Sync request failed.')
    }
    setSyncing(null)
  }

  const handleBulkSync = async (platform: ShopPlatform) => {
    setBulkSyncing(platform)
    setError(null)
    try {
      const res = await fetch('/api/social/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_sync', shopPlatform: platform }),
      })
      const data = await res.json()
      if (data.failed > 0) {
        setError(`${data.succeeded} synced, ${data.failed} failed`)
      } else {
        setSuccessMsg(`All ${data.succeeded} listings synced to ${SHOP_PLATFORM_CONFIG[platform].label}`)
        setTimeout(() => setSuccessMsg(null), 4000)
      }
      fetchListings()
    } catch {
      setError('Bulk sync failed.')
    }
    setBulkSyncing(null)
  }

  const handleDelete = async (listingId: string) => {
    if (!confirm('Remove this shop listing?')) return
    try {
      await fetch(`/api/social/shops?id=${listingId}`, { method: 'DELETE' })
      setListings((prev) => prev.filter((l) => l.id !== listingId))
    } catch {
      setError('Failed to remove listing.')
    }
  }

  // Filtered listings
  const filtered = listings.filter((l) => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!l.productName.toLowerCase().includes(q) && !l.productSku.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Stats
  const stats = {
    total: listings.length,
    active: listings.filter((l) => l.status === 'ACTIVE').length,
    errors: listings.filter((l) => l.status === 'ERROR' || l.status === 'REJECTED').length,
    pending: listings.filter((l) => l.status === 'PENDING').length,
  }

  const platformStats: Record<string, { total: number; active: number }> = {}
  for (const l of listings) {
    if (!platformStats[l.shopPlatform]) platformStats[l.shopPlatform] = { total: 0, active: 0 }
    platformStats[l.shopPlatform].total++
    if (l.status === 'ACTIVE') platformStats[l.shopPlatform].active++
  }

  return (
    <div className="space-y-6">
      {/* Banners */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-600"><Package className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-slate-500">Total Listings</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-slate-500">Active</p>
            <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-600"><Clock className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-slate-500">Pending Sync</p>
            <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-red-100 p-3 text-red-600"><AlertCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-slate-500">Errors</p>
            <p className="text-2xl font-bold text-slate-900">{stats.errors}</p>
          </div>
        </Card>
      </div>

      {/* Platform cards with bulk actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(['FACEBOOK_SHOP', 'FACEBOOK_MARKETPLACE', 'TIKTOK_SHOP'] as ShopPlatform[]).map((platform) => {
          const config = SHOP_PLATFORM_CONFIG[platform]
          const Icon = SHOP_ICONS[platform]
          const ps = platformStats[platform] || { total: 0, active: 0 }
          const isConnected = platform === 'TIKTOK_SHOP' ? hasTikTok : hasFacebook

          return (
            <Card key={platform} className="overflow-hidden">
              <div className={cn('h-1.5', config.bgColor)} />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className={cn('rounded-xl p-2.5', config.textColor, 'bg-slate-100')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{config.label}</p>
                    <p className="text-xs text-slate-500">
                      {ps.active}/{ps.total} active
                    </p>
                  </div>
                  <div className={cn('h-2.5 w-2.5 rounded-full', isConnected ? 'bg-emerald-400' : 'bg-slate-300')} />
                </div>
                <p className="mt-2 text-xs text-slate-500">{config.description}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleBulkSync(platform)}
                    disabled={!isConnected || ps.total === 0 || bulkSyncing === platform}
                  >
                    {bulkSyncing === platform ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                    )}
                    Sync All
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setAddPlatform(platform)
                      setShowAddPanel(true)
                      fetchProducts()
                    }}
                    disabled={!isConnected}
                  >
                    <Plus className="mr-1.5 h-3 w-3" />
                    Add
                  </Button>
                </div>
                {!isConnected && (
                  <p className="mt-2 text-xs text-amber-600">
                    Connect {platform === 'TIKTOK_SHOP' ? 'TikTok' : 'Facebook'} in Accounts tab first
                  </p>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Add products panel */}
      {showAddPanel && (
        <Card className="border-2 border-dashed border-salsa-300 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                Add Products to {SHOP_PLATFORM_CONFIG[addPlatform].label}
              </h3>
              <p className="text-sm text-slate-500">
                Select products to list on this shop platform.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAddPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Catalog / Shop ID input */}
          <div className="mt-4 max-w-sm space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Settings2 className="h-3.5 w-3.5 text-slate-400" />
              {addPlatform === 'TIKTOK_SHOP' ? 'TikTok Shop ID' : 'Facebook Catalog ID'}
            </label>
            <Input
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              placeholder={addPlatform === 'TIKTOK_SHOP' ? 'Enter your TikTok Shop ID' : 'Enter your Facebook Commerce Catalog ID'}
              className="text-sm"
            />
            <p className="text-xs text-slate-400">
              {addPlatform === 'TIKTOK_SHOP'
                ? 'Find this in TikTok Seller Center > Shop Settings'
                : addPlatform === 'FACEBOOK_SHOP'
                  ? 'Find this in Facebook Commerce Manager > Catalog'
                  : 'Optional for Marketplace listings'}
            </p>
          </div>

          {/* Product selection */}
          <div className="mt-4">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="rounded-lg bg-slate-50 py-8 text-center text-sm text-slate-500">
                {listings.length > 0
                  ? 'All products are already listed on this platform.'
                  : 'No active products found.'}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    {selectedProducts.size} of {availableProducts.length} selected
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedProducts.size === availableProducts.length) {
                        setSelectedProducts(new Set())
                      } else {
                        setSelectedProducts(new Set(availableProducts.map((p) => p.id)))
                      }
                    }}
                  >
                    {selectedProducts.size === availableProducts.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  {availableProducts.map((product) => (
                    <label
                      key={product.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 transition last:border-0 hover:bg-slate-50',
                        selectedProducts.has(product.id) && 'bg-salsa-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-salsa-600"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => {
                          setSelectedProducts((prev) => {
                            const next = new Set(prev)
                            if (next.has(product.id)) next.delete(product.id)
                            else next.add(product.id)
                            return next
                          })
                        }}
                      />
                      {product.image && (
                        <img src={product.image} alt="" className="h-8 w-8 rounded object-cover" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{product.name}</p>
                        <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-600">${product.price}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleAddProducts} disabled={selectedProducts.size === 0}>
                    <Upload className="mr-2 h-4 w-4" />
                    Add {selectedProducts.size} Product{selectedProducts.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Listings table */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-slate-900">Shop Listings</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value as ShopPlatform | 'all')}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            >
              <option value="all">All Platforms</option>
              <option value="FACEBOOK_SHOP">Facebook Shop</option>
              <option value="FACEBOOK_MARKETPLACE">Marketplace</option>
              <option value="TIKTOK_SHOP">TikTok Shop</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ShopListingStatus | 'all')}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="ERROR">Error</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Product</th>
                <th className="px-5 py-3 text-left font-medium">Platform</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Price</th>
                <th className="px-5 py-3 text-left font-medium">Inventory</th>
                <th className="px-5 py-3 text-left font-medium">Last Synced</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    {listings.length === 0
                      ? 'No shop listings yet. Add products above to get started.'
                      : 'No listings match your filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((listing) => {
                  const platformConfig = SHOP_PLATFORM_CONFIG[listing.shopPlatform]
                  const statusConfig = STATUS_CONFIG[listing.status]
                  const StatusIcon = statusConfig.icon
                  const PlatformIcon = SHOP_ICONS[listing.shopPlatform]
                  const displayPrice = listing.priceOverride || listing.productPrice

                  return (
                    <tr key={listing.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {listing.productImage ? (
                            <img src={listing.productImage} alt="" className="h-9 w-9 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                              <Package className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-800">
                              {listing.titleOverride || listing.productName}
                            </p>
                            <p className="text-xs text-slate-500">SKU: {listing.productSku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', platformConfig.textColor)}>
                          <PlatformIcon className="h-3.5 w-3.5" />
                          {platformConfig.shortLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={cn('gap-1 text-xs', statusConfig.className)}>
                          <StatusIcon className={cn('h-3 w-3', listing.status === 'SYNCING' && 'animate-spin')} />
                          {statusConfig.label}
                        </Badge>
                        {listing.syncError && (
                          <p className="mt-1 max-w-[200px] truncate text-xs text-red-500" title={listing.syncError}>
                            {listing.syncError}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">${displayPrice}</td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'text-sm',
                            listing.productInventory <= 0
                              ? 'font-semibold text-red-600'
                              : listing.productInventory <= 5
                                ? 'text-amber-600'
                                : 'text-slate-700',
                          )}
                        >
                          {listing.productInventory}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                        {listing.lastSyncedAt
                          ? new Date(listing.lastSyncedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {listing.externalUrl && (
                            <a
                              href={listing.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              title="View on platform"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleSync(listing.id)}
                            disabled={syncing === listing.id}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                            title="Sync to platform"
                          >
                            {syncing === listing.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(listing.id)}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Remove listing"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Setup guide */}
      <Card className="border-blue-200 bg-blue-50 p-5">
        <h4 className="font-semibold text-blue-900">Shop Integration Setup</h4>
        <div className="mt-3 grid gap-4 text-sm text-blue-800 sm:grid-cols-3">
          <div>
            <p className="font-medium">Facebook Shop</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
              <li>Create a Commerce catalog in Facebook Commerce Manager</li>
              <li>Link the catalog to your Facebook Page</li>
              <li>Enter the Catalog ID when adding products</li>
              <li>Products sync via the Catalog Batch API</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">Facebook Marketplace</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
              <li>Requires a connected Facebook Page</li>
              <li>Listings created via Page Commerce API</li>
              <li>Supports local and shipped items</li>
              <li>Inventory synced from your product catalog</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">TikTok Shop</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
              <li>Register at TikTok Seller Center</li>
              <li>Enable Product API access in your developer app</li>
              <li>Enter your Shop ID when adding products</li>
              <li>Products sync via TikTok Open API</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
