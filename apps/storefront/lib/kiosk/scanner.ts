/**
 * USB barcode scanners type the code like a very fast keyboard and press Enter.
 * Feed every keydown here; it returns the code when a burst ends in Enter, and ignores
 * slow human typing (a pause longer than `maxGapMs` between keys starts a new burst).
 */
export function createScanBuffer({ maxGapMs = 60, minLength = 8 } = {}) {
  let chars = ''
  let last = 0

  return (key: string, at: number): string | null => {
    if (at - last > maxGapMs) chars = ''
    last = at
    if (key === 'Enter') {
      const code = chars
      chars = ''
      return code.length >= minLength ? code : null
    }
    if (/^[0-9A-Za-z]$/.test(key)) chars += key
    return null
  }
}
