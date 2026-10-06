import { randomInt } from 'crypto'

/**
 * Fundraiser codes for the José Madrid Salsa Battle Arena browser game.
 *
 * An admin makes one code per fundraising group and hands it to that group's
 * players. The game asks the site to verify a typed code before online play
 * and tournaments, so the same code works on every device.
 */

// No 0/O or 1/I lookalikes. Must match the game's alphabet.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** "jm 7kq4 x2pd", "JM7KQ4X2PD" and "JM-7KQ4-X2PD" are the same code. Returns null when it is not code-shaped. */
export function normalizeGameCode(input: string): string | null {
  let raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.length === 8) raw = `JM${raw}`
  if (!/^JM[A-Z0-9]{8}$/.test(raw)) return null
  return `JM-${raw.slice(2, 6)}-${raw.slice(6)}`
}

/** A fresh random code, formatted JM-XXXX-XXXX. */
export function generateGameCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  return `JM-${chars.slice(0, 4)}-${chars.slice(4)}`
}
