'use client'

import { Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/ui/theme-provider'

type ThemeToggleProps = {
  className?: string
  size?: 'default' | 'sm'
}

export function ThemeToggle({ className, size = 'sm' }: ThemeToggleProps) {
  const { toggleTheme, isDark, isMounted } = useTheme()

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  // Prevent hydration mismatch by using consistent initial state
  // On server, always render as if light mode (isDark = false)
  const displayIsDark = isMounted ? isDark : false

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      aria-label="Toggle color theme"
      onClick={toggleTheme}
      className={cn(
        'relative overflow-hidden rounded-full px-2 transition-colors hover:bg-accent hover:text-accent-foreground',
        className
      )}
    >
      <Sun
        className={cn(
          iconSize,
          'transition-all duration-300',
          displayIsDark ? '-translate-y-5 rotate-180 scale-0 opacity-0' : 'translate-y-0 rotate-0 scale-100 opacity-100',
          !isMounted && 'transition-none'
        )}
      />
      <Moon
        className={cn(
          iconSize,
          'absolute inset-0 m-auto transition-all duration-300',
          displayIsDark ? 'translate-y-0 rotate-0 scale-100 opacity-100' : 'translate-y-5 rotate-180 scale-0 opacity-0',
          !isMounted && 'transition-none'
        )}
      />
    </Button>
  )
}
