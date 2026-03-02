'use client'

import { useWishlistSync } from '@/lib/hooks/use-wishlist-sync'

/**
 * Client component that syncs wishlist state with authentication
 * Add this to the root layout to enable automatic wishlist synchronization
 */
export function WishlistSyncProvider() {
  useWishlistSync()
  return null
}
