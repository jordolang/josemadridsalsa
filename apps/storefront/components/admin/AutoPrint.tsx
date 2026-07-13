'use client'

import { useEffect } from 'react'

export default function AutoPrint() {
  useEffect(() => {
    // Small delay to ensure styles/images are loaded before printing
    const timer = setTimeout(() => {
      window.print()
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  return null
}
