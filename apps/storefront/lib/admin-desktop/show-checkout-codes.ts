/**
 * The show checkout code sheet: one letter page to keep on the cart.
 *
 * It carries the dates code (switch between scanning cases and entering
 * dates), the half-case code, and 01 to 31, so a case dated February 15 can be
 * entered by scanning 02 then 15 instead of typing. Printed like the packing
 * slip, in a window with scripts off, so it is self-contained.
 */

import { code128Svg } from './code128'
import { DATES_CODE, DIGIT_CODE_PREFIX, HALF_CODE } from './show-checkout'
import { escapeHtml } from './packing-slip'

const pad = (value: number) => String(value).padStart(2, '0')

function cell(label: string, value: string, help?: string): string {
  return `<div class="cell"><div class="label">${escapeHtml(label)}</div>${code128Svg(value, { module: 1.6, height: 44 })}${
    help ? `<div class="help">${escapeHtml(help)}</div>` : ''
  }</div>`
}

export function showCheckoutCodesHtml(): string {
  const digits = Array.from({ length: 31 }, (_, index) => cell(pad(index + 1), `${DIGIT_CODE_PREFIX}${pad(index + 1)}`)).join('')

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Show checkout codes</title>
<style>
@page { size: letter; margin: 0.4in }
body { font: 10pt/1.3 Helvetica, Arial, sans-serif; color: #111; margin: 0 }
h1 { font-size: 15pt; color: #b91c1c; margin: 0 0 2pt }
p { margin: 0 0 10pt; color: #444 }
.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; margin-bottom: 10pt }
.grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6pt }
.cell { border: 1px solid #bbb; border-radius: 4pt; padding: 5pt; text-align: center; break-inside: avoid }
.cell svg { max-width: 100%; height: 40pt }
.label { font-size: 16pt; font-weight: bold; margin-bottom: 3pt }
.controls .label { font-size: 13pt }
.help { font-size: 8pt; color: #555; margin-top: 2pt }
</style></head><body>
<h1>Show checkout codes</h1>
<p>Scan <b>Dates</b> when the cart is full, then scan a case label and its date: two codes, month then day (02 then 15 is 02/15). The year is filled in.</p>
<div class="controls">
${cell('Dates', DATES_CODE, 'Switch between scanning cases and entering dates')}
${cell('Half case', HALF_CODE, 'The next case scanned counts as half (6 jars)')}
</div>
<div class="grid">${digits}</div>
</body></html>`
}
