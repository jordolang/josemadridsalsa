'use client'

import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFundraisingCart } from '@/lib/fundraising-site/cart-store'

/** Remembers the group for checkout, then opens the shop. */
export function SupportGroupButton({ group, size = 'lg' }: { group: string; size?: 'sm' | 'lg' }) {
  const setGroup = useFundraisingCart((state) => state.setGroup)
  const router = useRouter()

  return (
    <Button
      size={size}
      className="bg-salsa-600 hover:bg-salsa-700"
      onClick={() => {
        setGroup(group)
        router.push('/shop')
      }}
    >
      <Heart className="mr-2 h-4 w-4" aria-hidden />
      Shop for this group
    </Button>
  )
}
