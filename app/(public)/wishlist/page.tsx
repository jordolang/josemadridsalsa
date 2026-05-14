'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Heart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWishlistStore } from '@/lib/store/wishlist'
import { WishlistItemCard } from '@/components/wishlist/wishlist-item-card'
import { EmptyWishlist } from '@/components/wishlist/empty-wishlist'
import { Skeleton } from '@/components/ui/skeleton'

export default function WishlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { items, isLoading, fetchWishlist, clearWishlist } = useWishlistStore()

  // Use selector for computed value
  const totalItems = useWishlistStore((state) => state.items.length)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/wishlist')
    }
  }, [status, router])

  // Fetch wishlist on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchWishlist()
    }
  }, [status, fetchWishlist])

  // Show loading skeleton while checking auth or loading wishlist
  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (status === 'unauthenticated') {
    return null
  }

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear your entire wishlist?')) {
      // Remove all items one by one (API calls will be made)
      const removePromises = items.map((item) =>
        fetch('/api/wishlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: item.productId }),
        })
      )

      try {
        await Promise.all(removePromises)
        clearWishlist()
      } catch (error) {
        console.error('Error clearing wishlist:', error)
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Heart className="w-8 h-8 text-salsa-500" />
            My Wishlist
          </h1>
          <p className="text-muted-foreground mt-2">
            {totalItems === 0
              ? 'No items saved yet'
              : `${totalItems} ${totalItems === 1 ? 'item' : 'items'} saved`}
          </p>
        </div>

        {totalItems > 0 && (
          <Button
            onClick={handleClearAll}
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Content */}
      {totalItems === 0 ? (
        <EmptyWishlist />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <WishlistItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
