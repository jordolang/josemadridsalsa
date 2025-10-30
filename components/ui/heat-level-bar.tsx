'use client'

import { cn } from '@/lib/utils'

interface HeatLevelBarProps {
  level: number
  maxLevel?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function HeatLevelBar({ 
  level, 
  maxLevel = 10, 
  showLabel = true, 
  size = 'md',
  className 
}: HeatLevelBarProps) {
  const percentage = Math.min((level / maxLevel) * 100, 100)
  
  // Create dynamic width classes
  const getWidthClass = (percentage: number) => {
    if (percentage <= 10) return 'w-[10%]'
    if (percentage <= 20) return 'w-[20%]'
    if (percentage <= 30) return 'w-[30%]'
    if (percentage <= 40) return 'w-[40%]'
    if (percentage <= 50) return 'w-[50%]'
    if (percentage <= 60) return 'w-[60%]'
    if (percentage <= 70) return 'w-[70%]'
    if (percentage <= 80) return 'w-[80%]'
    if (percentage <= 90) return 'w-[90%]'
    return 'w-full'
  }
  
  const getHeatColor = (level: number) => {
    if (level <= 2) return 'bg-green-400'
    if (level <= 4) return 'bg-yellow-400'
    if (level <= 6) return 'bg-orange-400'
    if (level <= 8) return 'bg-red-400'
    return 'bg-red-600'
  }

  const getHeatLabel = (level: number) => {
    if (level <= 2) return 'Mild'
    if (level <= 4) return 'Medium'
    if (level <= 6) return 'Hot'
    if (level <= 8) return 'Very Hot'
    return 'Extreme'
  }

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className={cn('font-medium text-gray-700 min-w-[60px]', textSizeClasses[size])}>
          {getHeatLabel(level)}
        </span>
      )}
      
      <div className="flex-1 relative">
        {/* Background bar */}
        <div className={cn(
          'w-full bg-gray-200 rounded-full overflow-hidden',
          sizeClasses[size]
        )}>
          {/* Heat level bar */}
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              getHeatColor(level),
              getWidthClass(percentage)
            )}
          />
        </div>
        
        {/* Heat level number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn(
            'font-bold text-white drop-shadow-sm',
            textSizeClasses[size]
          )}>
            {level}/10
          </span>
        </div>
      </div>
    </div>
  )
}
