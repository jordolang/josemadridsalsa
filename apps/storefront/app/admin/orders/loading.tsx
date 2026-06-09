import { Skeleton } from '@/components/ui/skeleton'

export default function OrdersLoading() {
  return (
    <>
      {/* Mobile skeleton */}
      <div className="md:hidden flex flex-col gap-3 p-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-16 rounded-full" />
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-20 rounded-full" />
        </div>
        <ul className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-[72px] w-full rounded-lg" />
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop skeleton */}
      <div className="hidden md:block space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-[480px] w-full rounded-lg" />
      </div>
    </>
  )
}
