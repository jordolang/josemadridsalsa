import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useWishlistStore } from '@/lib/store/wishlist'

/**
 * Sync wishlist with database based on authentication status
 * - Fetches wishlist when user signs in
 * - Clears local wishlist when user signs out
 */
export function useWishlistSync() {
  const { data: session, status } = useSession()
  const { fetchWishlist, clearWishlist } = useWishlistStore()

  useEffect(() => {
    if (status === 'authenticated') {
      // User is signed in - fetch their wishlist from the database
      fetchWishlist()
    } else if (status === 'unauthenticated') {
      // User is signed out - clear the local wishlist
      clearWishlist()
    }
    // Don't do anything while status is 'loading'
  }, [status, fetchWishlist, clearWishlist])
}
