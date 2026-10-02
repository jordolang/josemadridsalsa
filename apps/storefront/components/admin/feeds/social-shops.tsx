'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Facebook,
  Globe,
  Music2,
  ShoppingBag,
  ShoppingCart,
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
import type { ShopPlatform, ShopListingStatus, SocialMediaPlatform } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { ShopListingInfo, SocialAccountInfo } from '@/types/social'
import { SHOP_PLATFORM_CONFIG } from '@/types/social'

const STATUS_CONFIG: Record<ShopListingStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-muted text-muted-foreground' },
  SYNCING: { label: 'Syncing', icon: Loader2, className: 'bg-primary/10 text-primary' },
  ACTIVE: { label: 'Active', icon: CheckCircle2, className: 'bg-primary/10 text-primary' },
  PAUSED: { label: 'Paused', icon: Clock, className: 'bg-muted text-muted-foreground' },
  REJECTED: { label: 'Rejected', icon: AlertCircle, className: 'bg-destructive/10 text-destructive' },
  ERROR: { label: 'Error', icon: AlertCircle, className: 'bg-destructive/10 text-destructive' },
}

const SHOP_ICONS: Record<ShopPlatform, React.ElementType> = {
  FACEBOOK_SHOP: ShoppingBag,
  FACEBOOK_MARKETPLACE: Store,
  TIKTOK_SHOP: Music2,
  AMAZON: ShoppingCart,
  GOOGLE_SHOPPING: Globe,
}

const ALL_PLATFORMS: ShopPlatform[] = [
  'FACEBOOK_SHOP',
  'FACEBOOK_MARKETPLACE',
  'TIKTOK_SHOP',
  'AMAZON',
  'GOOGLE_SHOPPING',
]

/** Env-var hints for platforms that sync with server credentials. */
const CREDENTIAL_HINTS: Partial<Record<ShopPlatform, string>> = {
  AMAZON: 'Set the AMAZON_SP_API_* environment variables to enable syncing',
  TIKTOK_SHOP: 'Set the TIKTOK_SHOP_APP_KEY, _APP_SECRET and _REFRESH_TOKEN environment variables to enable syncing',
  GOOGLE_SHOPPING:
    'Set GOOGLE_MERCHANT_CENTER_ID, GOOGLE_MERCHANT_DATA_SOURCE_ID and the GOOGLE_SHOPPING_SERVICE_ACCOUNT_* environment variables to enable syncing',
}

type Props = {
  accounts: SocialAccountInfo[]
  /** Whether server credentials exist for platforms that don't use a connected social account. */
  syncProviderStatus: { AMAZON: boolean; GOOGLE_SHOPPING: boolean; TIKTOK_SHOP: boolean }
}

export function SocialShops({ accounts, syncProviderStatus }: Props) {
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
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [catalogId, setCatalogId] = useState('')
  const [facebookBusinessId, setFacebookBusinessId] = useState('')
  const [facebookCatalogName, setFacebookCatalogName] = useState('Jose Madrid Salsa Catalog')
  const [creatingCatalog, setCreatingCatalog] = useState(false)
  const [availableProducts, setAvailableProducts] = useState<Array<{ id: string; name: string; sku: string; price: string; image: string | null }>>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [loadingProducts, setLoadingProducts] = useState(false)

  const hasFacebook = accounts.some((a) => a.platform === 'FACEBOOK')
  // null = the platform syncs with server credentials, not a connected account.
  const accountPlatformForShop = useMemo<Record<ShopPlatform, SocialMediaPlatform | null>>(() => ({
    FACEBOOK_SHOP: 'FACEBOOK',
    FACEBOOK_MARKETPLACE: 'FACEBOOK',
    TIKTOK_SHOP: null,
    AMAZON: null,
    GOOGLE_SHOPPING: null,
  }), [])
  const addPlatformNeedsAccount = accountPlatformForShop[addPlatform] !== null
  const isPlatformReady = (platform: ShopPlatform): boolean => {
    switch (accountPlatformForShop[platform]) {
      case 'FACEBOOK':
        return hasFacebook
      default:
        return syncProviderStatus[platform as 'AMAZON' | 'GOOGLE_SHOPPING' | 'TIKTOK_SHOP']
    }
  }
  const matchingAccounts = useMemo(
    () => accounts.filter((account) => account.platform === accountPlatformForShop[addPlatform]),
    [accounts, addPlatform, accountPlatformForShop],
  )

  useEffect(() => {
    if (!showAddPanel) return
    if (matchingAccounts.length === 0) {
      setSelectedAccountId('')
      return
    }
    setSelectedAccountId((current) =>
      matchingAccounts.some((account) => account.id === current)
        ? current
        : matchingAccounts[0].id,
    )
  }, [matchingAccounts, showAddPanel])

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

  const fetchProducts = async (platformOverride: ShopPlatform = addPlatform) => {
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
        listings.filter((l) => l.shopPlatform === platformOverride).map((l) => l.productId),
      )
      setAvailableProducts(products.filter((p: { id: string }) => !existingIds.has(p.id)))
    } catch {
      setAvailableProducts([])
    }
    setLoadingProducts(false)
  }

  const handleAddProducts = async () => {
    if (selectedProducts.size === 0) return
    if (addPlatformNeedsAccount && !selectedAccountId) {
      setError('Choose the connected account that should own these exports.')
      return
    }
    setError(null)
    try {
      const res = await fetch('/api/social/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_create',
          productIds: Array.from(selectedProducts),
          shopPlatform: addPlatform,
          socialAccountId: addPlatformNeedsAccount ? selectedAccountId : undefined,
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

  const handleCreateFacebookCatalog = async () => {
    if (!selectedAccountId || !facebookBusinessId.trim() || !facebookCatalogName.trim()) {
      setError('Choose a Facebook Page, Business ID, and catalog name first.')
      return
    }

    setCreatingCatalog(true)
    setError(null)
    try {
      const res = await fetch('/api/social/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_facebook_catalog',
          socialAccountId: selectedAccountId,
          businessId: facebookBusinessId.trim(),
          name: facebookCatalogName.trim(),
        }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else if (data.catalogId) {
        setCatalogId(data.catalogId)
        setSuccessMsg('Facebook catalog created. You can now add products to it.')
        setTimeout(() => setSuccessMsg(null), 4000)
      }
    } catch {
      setError('Failed to create Facebook catalog.')
    }
    setCreatingCatalog(false)
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
      const res = await fetch(`/api/social/shops?id=${listingId}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Failed to remove listing.')
      } else {
        setListings((prev) => prev.filter((l) => l.id !== listingId))
      }
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
        <Alert variant="destructive" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setError(null)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss error</span>
          </Button>
        </Alert>
      )}
      {successMsg && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-muted p-3 text-muted-foreground"><Package className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Total Listings</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-emerald-100 p-3 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-amber-100 p-3 text-muted-foreground"><Clock className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Pending Sync</p>
            <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-destructive/10 p-3 text-destructive"><AlertCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Errors</p>
            <p className="text-2xl font-bold text-foreground">{stats.errors}</p>
          </div>
        </Card>
      </div>

      {/* Platform cards with bulk actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_PLATFORMS.map((platform) => {
          const config = SHOP_PLATFORM_CONFIG[platform]
          const Icon = SHOP_ICONS[platform]
          const ps = platformStats[platform] || { total: 0, active: 0 }
          const isConnected = isPlatformReady(platform)

          return (
            <Card key={platform} className="overflow-hidden">
              <div className={cn('h-1.5', config.bgColor)} />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className={cn('rounded-xl p-2.5', config.textColor, 'bg-muted')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ps.active}/{ps.total} active
                    </p>
                  </div>
                  <div className={cn('h-2.5 w-2.5 rounded-full', isConnected ? 'bg-emerald-400' : 'bg-muted')} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{config.description}</p>
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
                        setCatalogId('')
                        setFacebookBusinessId('')
                        setSelectedProducts(new Set())
                        setShowAddPanel(true)
                        fetchProducts(platform)
                      }}
                     disabled={!isConnected}
                   >
                    <Plus className="mr-1.5 h-3 w-3" />
                    Add
                  </Button>
                </div>
                {!isConnected && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {CREDENTIAL_HINTS[platform] ??
                      'Connect Facebook in Social Media → Accounts first'}
                  </p>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Add products panel */}
      {showAddPanel && (
        <Card className="border-2 border-dashed border-primary p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                Add Products to {SHOP_PLATFORM_CONFIG[addPlatform].label}
              </h3>
              <p className="text-sm text-muted-foreground">
                Select products to list on this shop platform.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAddPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!addPlatformNeedsAccount && (
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {addPlatform === 'AMAZON'
                ? 'Amazon exports sync through the Selling Partner API using the server credentials — no connected account or catalog ID needed. Products are matched to Amazon’s catalog by UPC (product barcode).'
                : addPlatform === 'TIKTOK_SHOP'
                  ? 'TikTok Shop exports sync through the TikTok Shop Partner API using the server credentials — no connected account needed. Products go to the first shop that authorized the app.'
                  : 'Google Shopping exports sync through the Merchant API using the configured Merchant Center service account — no connected account or catalog ID needed.'}
            </div>
          )}

          {addPlatformNeedsAccount && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                Export destination account
              </label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Choose a connected account" />
                </SelectTrigger>
                <SelectContent>
                  {matchingAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountHandle || account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Each export targets the selected Facebook Page.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                Facebook Catalog ID
              </label>
              <Input
                value={catalogId}
                onChange={(e) => setCatalogId(e.target.value)}
                placeholder="Enter or create a Facebook Catalog ID"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {addPlatform === 'FACEBOOK_SHOP'
                  ? 'Use an existing Commerce catalog or create one below if your Meta business is ready.'
                  : 'Meta has no public Marketplace listing API. Products sync to this Commerce catalog, and Meta decides whether they appear on Marketplace.'}
              </p>
            </div>
          </div>
          )}

          {addPlatform === 'FACEBOOK_SHOP' && (
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="facebook-business-id">Meta Business ID</Label>
                  <Input
                    id="facebook-business-id"
                    value={facebookBusinessId}
                    onChange={(e) => setFacebookBusinessId(e.target.value)}
                    placeholder="Enter the Meta Business Manager ID"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="facebook-catalog-name">Catalog name</Label>
                  <Input
                    id="facebook-catalog-name"
                    value={facebookCatalogName}
                    onChange={(e) => setFacebookCatalogName(e.target.value)}
                    placeholder="Jose Madrid Salsa Catalog"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleCreateFacebookCatalog}
                  disabled={creatingCatalog || !selectedAccountId}
                >
                  {creatingCatalog ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create Catalog
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Meta may still require Commerce Manager review before the storefront becomes live, but catalog creation is handled here.
              </p>
            </div>
          )}

          {/* Product selection */}
          <div className="mt-4">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="rounded-lg bg-muted/50 py-8 text-center text-sm text-muted-foreground">
                {listings.length > 0
                  ? 'All products are already listed on this platform.'
                  : 'No active products found.'}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
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
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  {availableProducts.map((product) => {
                    const isSelected = selectedProducts.has(product.id)
                    const toggle = () => {
                      setSelectedProducts((prev) => {
                        const next = new Set(prev)
                        if (next.has(product.id)) next.delete(product.id)
                        else next.add(product.id)
                        return next
                      })
                    }
                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'flex items-center gap-3 border-b border-border px-4 py-2.5 transition last:border-0 hover:bg-muted/50',
                          isSelected && 'bg-primary/5',
                        )}
                      >
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={isSelected}
                          onCheckedChange={toggle}
                        />
                        {product.image && (
                          <img src={product.image} alt="" className="h-8 w-8 rounded object-cover" />
                        )}
                        <Label
                          htmlFor={`product-${product.id}`}
                          className="flex-1 cursor-pointer font-normal"
                        >
                          <p className="text-sm font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                        </Label>
                        <span className="text-sm font-medium text-muted-foreground">${product.price}</span>
                      </div>
                    )
                  })}
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
          <h3 className="font-semibold text-foreground">Shop Listings</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select
              value={filterPlatform}
              onValueChange={(value) => setFilterPlatform(value as ShopPlatform | 'all')}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="FACEBOOK_SHOP">Facebook Shop</SelectItem>
                <SelectItem value="FACEBOOK_MARKETPLACE">Marketplace</SelectItem>
                <SelectItem value="TIKTOK_SHOP">TikTok Shop</SelectItem>
                <SelectItem value="AMAZON">Amazon</SelectItem>
                <SelectItem value="GOOGLE_SHOPPING">Google Shopping</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value as ShopListingStatus | 'all')}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Target Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    {listings.length === 0
                      ? 'No shop listings yet. Add products above to get started.'
                      : 'No listings match your filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((listing) => {
                  const platformConfig = SHOP_PLATFORM_CONFIG[listing.shopPlatform]
                  const statusConfig = STATUS_CONFIG[listing.status]
                  const StatusIcon = statusConfig.icon
                  const PlatformIcon = SHOP_ICONS[listing.shopPlatform]
                  const displayPrice = listing.priceOverride || listing.productPrice

                  return (
                    <TableRow key={listing.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {listing.productImage ? (
                            <img src={listing.productImage} alt="" className="h-9 w-9 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-foreground">
                              {listing.titleOverride || listing.productName}
                            </p>
                            <p className="text-xs text-muted-foreground">SKU: {listing.productSku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', platformConfig.textColor)}>
                          <PlatformIcon className="h-3.5 w-3.5" />
                          {platformConfig.shortLabel}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">
                            {listing.targetAccountName ||
                              (accountPlatformForShop[listing.shopPlatform] === null
                                ? 'API credentials'
                                : 'Not selected')}
                          </p>
                          {(listing.targetAccountHandle || listing.targetAccountPlatform) && (
                            <p className="text-muted-foreground">
                              {listing.targetAccountHandle ||
                                (listing.targetAccountPlatform === 'FACEBOOK'
                                  ? 'Facebook'
                                  : 'TikTok')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('gap-1 text-xs', statusConfig.className)}>
                          <StatusIcon className={cn('h-3 w-3', listing.status === 'SYNCING' && 'animate-spin')} />
                          {statusConfig.label}
                        </Badge>
                        {listing.syncError && (
                          <p className="mt-1 max-w-[200px] truncate text-xs text-destructive" title={listing.syncError}>
                            {listing.syncError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">${displayPrice}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'text-sm',
                            listing.productInventory <= 0
                              ? 'font-semibold text-destructive'
                              : listing.productInventory <= 5
                                ? 'text-muted-foreground'
                                : 'text-foreground',
                          )}
                        >
                          {listing.productInventory}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {listing.lastSyncedAt
                          ? new Date(listing.lastSyncedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {listing.externalUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="View on platform"
                              asChild
                            >
                              <a
                                href={listing.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="sr-only">View on platform</span>
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleSync(listing.id)}
                            disabled={syncing === listing.id}
                            title="Sync to platform"
                          >
                            {syncing === listing.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            <span className="sr-only">Sync listing</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(listing.id)}
                            title="Remove listing"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Remove listing</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Setup guide */}
      <Card className="border-border bg-muted/50 p-5">
        <h4 className="font-semibold text-foreground">Shop Integration Setup</h4>
        <div className="mt-3 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-medium text-foreground">Facebook Shop</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
              <li>Connect the exact Facebook Page that should own the export</li>
              <li>Create a Commerce catalog here or in Commerce Manager</li>
              <li>Enter the Catalog ID when adding products</li>
              <li>Products sync via the Catalog Batch API</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Facebook Marketplace</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
              <li>Requires a connected Facebook Page and a Commerce catalog ID</li>
              <li>Meta offers no public Marketplace listing API; products sync to the catalog via the Catalog Batch API</li>
              <li>Whether catalog products appear on Marketplace is decided by Meta in Commerce Manager</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">TikTok Shop</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
              <li>Create and approve the shop in TikTok Seller Center first</li>
              <li>Create an app in TikTok Shop Partner Center with Product and Logistics API access, and have the shop authorize it</li>
              <li>Set TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET and TIKTOK_SHOP_REFRESH_TOKEN env vars</li>
              <li>Products sync via the signed TikTok Shop Partner API (202309)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Amazon</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
              <li>Create a self-authorized SP-API app in Seller Central → Develop Apps</li>
              <li>Set AMAZON_SP_API_CLIENT_ID, _CLIENT_SECRET, _REFRESH_TOKEN, and _SELLER_ID env vars</li>
              <li>Products match Amazon&apos;s catalog by UPC (product barcode)</li>
              <li>Listings sync via the SP-API Listings Items API</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Google Shopping</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
              <li>Create a Google Cloud service account and enable the Merchant API</li>
              <li>Add the service account email as a user in Merchant Center settings, and register the Cloud project with the account once (Merchant API developer registration)</li>
              <li>Add an &quot;API&quot; data source in Merchant Center and note its ID</li>
              <li>Set GOOGLE_MERCHANT_CENTER_ID, GOOGLE_MERCHANT_DATA_SOURCE_ID and GOOGLE_SHOPPING_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY env vars</li>
              <li>Products sync via the Merchant API; the scheduled feed URL keeps working as a fallback</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
