import { Heart } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function EmptyWishlist() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-6">
        <Heart className="w-16 h-16 text-muted-foreground" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        Your wishlist is empty
      </h2>

      <p className="text-muted-foreground mb-8 max-w-md">
        Start adding your favorite salsas to your wishlist so you can easily find them later!
      </p>

      <Button asChild size="lg" className="bg-salsa-500 hover:bg-salsa-600">
        <Link href="/products">
          Browse Products
        </Link>
      </Button>
    </div>
  )
}
