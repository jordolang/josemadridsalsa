'use client'

import { useEffect } from 'react'

// The admin layout mounts each page twice (desktop and mobile frames, one
// hidden by CSS), so without this the print dialog would open twice.
let printScheduled = false

export default function AutoPrint() {
  useEffect(() => {
    if (printScheduled) return
    printScheduled = true
    // Small delay to ensure styles/images are loaded before printing
    const timer = setTimeout(() => {
      window.print()
    }, 300)
    return () => {
      clearTimeout(timer)
      printScheduled = false
    }
  }, [])

  return null
}
