/**
 * Code 128 (code set B) as an SVG, for barcodes printed on an office printer.
 *
 * The receipt printer draws its own barcodes from an ESC/POS command; a sheet
 * printed from a web page has to draw them itself. Code set B covers printable
 * ASCII, which is all the show checkout's code sheet needs.
 */

/** Bar and space widths, in modules, for symbol values 0–106 (106 is Stop). */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const

const START_B = 104
const STOP = 106

/** The symbol values for `text`: Start B, the characters, the check symbol, Stop. */
export function code128Values(text: string): number[] {
  const values = [...text].map((char) => {
    const code = char.charCodeAt(0)
    if (code < 32 || code > 126) throw new Error(`Code 128 B cannot encode ${JSON.stringify(char)}`)
    return code - 32
  })
  const check = values.reduce((sum, value, index) => sum + value * (index + 1), START_B) % 103
  return [START_B, ...values, check, STOP]
}

/** Module widths, alternating bar and space, starting with a bar. */
export function code128Widths(text: string): number[] {
  return code128Values(text).flatMap((value) => [...PATTERNS[value]].map(Number))
}

/** An SVG of the barcode, with the quiet zone either side, `height` user units tall. */
export function code128Svg(text: string, { module = 2, height = 60 }: { module?: number; height?: number } = {}): string {
  const quiet = 10 * module
  let x = quiet
  const bars: string[] = []
  code128Widths(text).forEach((width, index) => {
    if (index % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width * module}" height="${height}"/>`)
    x += width * module
  })
  const total = x + quiet
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" width="${total}" height="${height}" shape-rendering="crispEdges">${bars.join('')}</svg>`
}

export const CODE128_PATTERNS = PATTERNS
