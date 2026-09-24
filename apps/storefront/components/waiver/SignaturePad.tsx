'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'

const INK = '#1c1917'

/**
 * Finger/stylus signature box. Reports a PNG data URL after each stroke, or
 * null once cleared (or when a resize wipes the canvas).
 */
export function SignaturePad({
  onChange,
  disabled = false,
  className,
}: {
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 3
    context.strokeStyle = INK
    setHasInk(false)
    onChange(null)
  }, [onChange])

  useEffect(() => {
    setupCanvas()
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    let lastWidth = canvas.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => {
      // Rotating the iPad changes the width; resizing a canvas wipes it, so start over.
      if (entry && Math.abs(entry.contentRect.width - lastWidth) > 1) {
        lastWidth = entry.contentRect.width
        setupCanvas()
      }
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [setupCanvas])

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    event.preventDefault()
    try {
      // Keeps the stroke going if a finger slides past the edge; some browsers refuse it.
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Drawing still works without capture.
    }
    drawingRef.current = true
    const point = pointFrom(event)
    lastPointRef.current = point
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    // A tap with no movement still leaves a dot.
    context.beginPath()
    context.arc(point.x, point.y, 1.5, 0, Math.PI * 2)
    context.fillStyle = INK
    context.fill()
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return
    const context = event.currentTarget.getContext('2d')
    const last = lastPointRef.current
    if (!context || !last) return
    const point = pointFrom(event)
    context.beginPath()
    context.moveTo(last.x, last.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    lastPointRef.current = point
  }

  const finishStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    setHasInk(true)
    onChange(event.currentTarget.toDataURL('image/png'))
  }

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        aria-label="Signature area. Draw your signature with your finger."
        role="img"
        className={cn(
          'block h-48 w-full touch-none rounded-2xl border-2 border-dashed bg-white',
          hasInk ? 'border-verde-600' : 'border-stone-300',
          disabled && 'opacity-60',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      {!hasInk ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl text-stone-400">
          Sign here with your finger
        </span>
      ) : null}
      <span className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-stone-300" aria-hidden />
      {hasInk ? (
        <button
          type="button"
          onClick={setupCanvas}
          disabled={disabled}
          className="absolute right-3 top-3 inline-flex h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-base font-semibold text-stone-700 active:bg-stone-100"
        >
          <Eraser className="h-4 w-4" aria-hidden />
          Clear
        </button>
      ) : null}
    </div>
  )
}
