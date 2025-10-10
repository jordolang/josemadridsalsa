import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function ProductCardSkeleton({ className }: SkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="relative">
        {/* Image skeleton */}
        <Skeleton className="aspect-square w-full" />
        {/* Badge skeleton */}
        <Skeleton className="absolute top-3 left-3 h-6 w-16 rounded-full" />
        {/* Wishlist button skeleton */}
        <Skeleton className="absolute top-3 right-3 h-8 w-8 rounded-full" />
      </div>
      <CardContent className="p-4 space-y-3">
        {/* Title skeleton */}
        <Skeleton className="h-6 w-3/4" />
        {/* Description skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        {/* Heat level skeleton */}
        <Skeleton className="h-5 w-20 rounded-full" />
        {/* Price and button row */}
        <div className="flex items-center justify-between pt-2">
          <div className="space-y-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductGridSkeleton({ 
  count = 6, 
  columns = 3,
  className 
}: { 
  count?: number; 
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const gridColumns = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Header skeleton */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-6 w-96 mx-auto" />
      </div>

      {/* Controls skeleton */}
      <div className="space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
        <Skeleton className="h-9 w-72" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>

      {/* Products count skeleton */}
      <Skeleton className="h-5 w-48" />

      {/* Grid skeleton */}
      <div className={cn("grid gap-6", gridColumns[columns])}>
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("py-16 lg:py-24", className)}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Badges */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))}
          </div>
          
          {/* Subtitle */}
          <Skeleton className="h-5 w-48 mx-auto" />
          
          {/* Title */}
          <div className="space-y-2">
            <Skeleton className="h-16 w-full max-w-2xl mx-auto" />
            <Skeleton className="h-16 w-3/4 mx-auto" />
          </div>
          
          {/* Description */}
          <div className="space-y-2 max-w-2xl mx-auto">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5 mx-auto" />
            <Skeleton className="h-6 w-3/4 mx-auto" />
          </div>
          
          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-16 mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NavigationSkeleton({ className }: SkeletonProps) {
  return (
    <header className={cn("border-b bg-white", className)}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between lg:h-20">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Skeleton className="w-8 h-8 lg:w-10 lg:h-10 rounded-full" />
            <Skeleton className="h-6 w-40" />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:space-x-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-5 w-16" />
            ))}
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <Skeleton className="h-9 w-full rounded-l-lg" />
            <Skeleton className="h-9 w-16 rounded-r-lg" />
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 lg:space-x-4">
            <Skeleton className="w-9 h-9 rounded-md lg:hidden" />
            <Skeleton className="w-9 h-9 rounded-md hidden lg:block" />
            <Skeleton className="w-9 h-9 rounded-md hidden lg:block" />
            <Skeleton className="w-9 h-9 rounded-md" />
            <Skeleton className="w-9 h-9 rounded-md lg:hidden" />
          </div>
        </div>
      </div>
    </header>
  );
}

export function FooterSkeleton({ className }: SkeletonProps) {
  return (
    <footer className={cn("bg-gray-900", className)}>
      {/* Newsletter Section */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Skeleton className="h-8 w-48 mx-auto bg-gray-700" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-full max-w-2xl mx-auto bg-gray-700" />
              <Skeleton className="h-6 w-3/4 mx-auto bg-gray-700" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Skeleton className="h-10 flex-1 bg-gray-700" />
              <Skeleton className="h-10 w-32 bg-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2">
              <Skeleton className="w-10 h-10 rounded-full bg-gray-700" />
              <Skeleton className="h-6 w-40 bg-gray-700" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full bg-gray-700" />
              <Skeleton className="h-4 w-3/4 bg-gray-700" />
              <Skeleton className="h-4 w-1/2 bg-gray-700" />
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full bg-gray-700" />
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="space-y-4">
              <Skeleton className="h-5 w-20 bg-gray-700" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-4 w-24 bg-gray-700" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Skeleton className="h-4 w-40 bg-gray-700" />
            <div className="flex space-x-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="w-5 h-5 bg-gray-700" />
              ))}
            </div>
            <div className="flex space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-4 w-16 bg-gray-700" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function CardSkeleton({ className }: SkeletonProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-9 w-24" />
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ 
  count = 5, 
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-8 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Loading spinner component
export function LoadingSpinner({ 
  size = "default",
  className 
}: { 
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-4 h-4",
    default: "w-6 h-6", 
    lg: "w-8 h-8",
  };

  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-salsa-500", sizeClasses[size], className)} />
  );
}

// Page loading overlay
export function PageLoadingOverlay({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-lg font-medium text-gray-600">{message}</p>
      </div>
    </div>
  );
}