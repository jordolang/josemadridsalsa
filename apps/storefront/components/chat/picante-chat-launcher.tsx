'use client'

import { useEffect, useState } from 'react'
import styles from './picante-chat-launcher.module.css'

const WALK_FRAME_COUNT = 8
const WALK_FRAME_MS = 110
const CROSSING_MS = 8000

type Direction = 'idle' | 'left' | 'right'

export function PicanteChatLauncher({
  isOpen,
  onToggle,
}: {
  isOpen: boolean
  onToggle: () => void
}) {
  const [direction, setDirection] = useState<Direction>('idle')
  const [isAtLeft, setIsAtLeft] = useState(false)
  const [frame, setFrame] = useState(0)
  const [stayPut, setStayPut] = useState(true)

  useEffect(() => {
    // Picante stays parked in the corner for reduced motion, and on phones, where
    // pacing across the bottom of a narrow screen walks over the page content.
    const media = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 767px)')
    const syncPreference = () => setStayPut(media.matches)
    syncPreference()
    media.addEventListener('change', syncPreference)
    return () => media.removeEventListener('change', syncPreference)
  }, [])

  useEffect(() => {
    if (isOpen || stayPut) {
      setDirection('idle')
      setIsAtLeft(false)
      setFrame(0)
      return
    }

    let movingLeft = true
    setDirection('left')
    setIsAtLeft(true)

    const crossing = window.setInterval(() => {
      movingLeft = !movingLeft
      setDirection(movingLeft ? 'left' : 'right')
      setIsAtLeft(movingLeft)
    }, CROSSING_MS)

    return () => window.clearInterval(crossing)
  }, [isOpen, stayPut])

  useEffect(() => {
    if (direction === 'idle') return
    const animation = window.setInterval(() => {
      setFrame((current) => (current + 1) % WALK_FRAME_COUNT)
    }, WALK_FRAME_MS)
    return () => window.clearInterval(animation)
  }, [direction])

  const spriteClassName = [
    styles.sprite,
    direction === 'idle' ? styles.idle : direction === 'left' ? styles.walkLeft : styles.walkRight,
    styles[`frame${direction === 'idle' ? 0 : frame}`],
  ].join(' ')

  return (
    <div className={styles.track} aria-hidden={isOpen ? undefined : false}>
      <button
        type="button"
        onClick={onToggle}
        className={`${styles.launcher} ${isAtLeft ? styles.atLeft : styles.atRight}`}
        data-direction={direction}
        data-position={isAtLeft ? 'left' : 'right'}
        aria-label={isOpen ? 'Close chat window' : 'Chat with Picante'}
        title={isOpen ? 'Close chat' : 'Chat with Picante'}
      >
        <span className={spriteClassName} aria-hidden="true" />
        {!isOpen ? <span className={styles.prompt}>Need help?</span> : null}
      </button>
    </div>
  )
}
