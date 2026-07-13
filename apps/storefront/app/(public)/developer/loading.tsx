import { Skeleton } from '@/components/ui/skeleton'

export default function DeveloperLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-salsa-700 via-salsa-800 to-chile-700 py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-center lg:text-left order-2 lg:order-1 space-y-4">
                <Skeleton className="h-8 w-48 bg-white/10 mx-auto lg:mx-0" />
                <Skeleton className="h-14 w-72 bg-white/10 mx-auto lg:mx-0" />
                <Skeleton className="h-24 w-full max-w-lg bg-white/10 mx-auto lg:mx-0" />
                <Skeleton className="h-32 w-full max-w-lg bg-white/10 mx-auto lg:mx-0 rounded-xl" />
                <div className="flex gap-4 justify-center lg:justify-start">
                  <Skeleton className="h-12 w-36 bg-white/10 rounded-lg" />
                  <Skeleton className="h-12 w-44 bg-white/10 rounded-lg" />
                </div>
              </div>
              <div className="flex justify-center order-1 lg:order-2">
                <Skeleton className="w-64 h-64 lg:w-80 lg:h-80 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sections skeleton */}
      <div className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6 text-center">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-20 w-full max-w-2xl mx-auto" />
            <div className="grid md:grid-cols-3 gap-8 mt-8">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
