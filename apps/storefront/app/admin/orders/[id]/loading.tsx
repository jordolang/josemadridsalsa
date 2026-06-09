import { Skeleton } from '@/components/ui/skeleton'

export default function OrderDetailLoading() {
  return (
    <>
      {/* Mobile skeleton */}
      <div className="md:hidden flex h-full flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <div className="border-t p-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] flex gap-2">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 w-11" />
        </div>
      </div>

      {/* Desktop skeleton */}
      <div className="hidden md:block space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-10 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </>
  )
}
