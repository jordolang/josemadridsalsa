'use client'

import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'

const MAX_ROTATION = 10

export function useInteractiveCard<T extends HTMLElement = HTMLDivElement>() {
  const cardRef = useRef<T | null>(null)
  const prefersReducedMotionRef = useRef(false)

  const resetStyles = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.removeProperty('transform')
    card.style.removeProperty('box-shadow')
    card.style.setProperty('--interactive-card-glow-opacity', '0')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => {
      prefersReducedMotionRef.current = mediaQuery.matches
      if (mediaQuery.matches) {
        resetStyles()
      }
    }

    handleChange()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [resetStyles])

  const handlePointerMove = useCallback((event: React.PointerEvent<T>) => {
    if (prefersReducedMotionRef.current) {
      return
    }
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const pointX = event.clientX - rect.left
    const pointY = event.clientY - rect.top
    const percentX = (pointX / rect.width) * 2 - 1
    const percentY = (pointY / rect.height) * 2 - 1
    const rotateX = percentY * -MAX_ROTATION
    const rotateY = percentX * MAX_ROTATION
    const translateZ = 20
    card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(0, -4px, ${translateZ}px) scale(1.02)`
    const glowIntensity = 0.35 + Math.abs(percentX + percentY) * 0.1
    card.style.boxShadow = `0 25px 55px rgba(15, 23, 42, 0.25), 0 18px 35px rgba(229, 62, 62, ${glowIntensity})`
    card.style.setProperty('--interactive-card-glow-x', `${pointX}px`)
    card.style.setProperty('--interactive-card-glow-y', `${pointY}px`)
    card.style.setProperty('--interactive-card-glow-opacity', '1')
  }, [])

  const handlePointerLeave = useCallback(() => {
    resetStyles()
  }, [resetStyles])

  const handlePointerUp = useCallback(() => {
    resetStyles()
  }, [resetStyles])

  return {
    cardRef,
    handlePointerMove,
    handlePointerLeave,
    handlePointerUp,
  }
}
