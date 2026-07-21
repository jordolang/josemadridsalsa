import type { BusinessFormTemplate, BusinessFormSection, BusinessFormField } from '@/types/forms'
import { formLogoDataUri } from './logo'

type RenderOptions = {
  title?: string
  includeSections?: string[]
  includeBranding?: boolean
  notes?: string
}

const baseStyles = `
  * {
    box-sizing: border-box;
  }

  body {
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    color: #0f172a;
    background-color: #f8fafc;
    margin: 0;
    padding: 32px;
  }

  .form-wrapper {
    max-width: 960px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 20px;
    padding: 40px 48px;
    box-shadow: 0 30px 60px rgba(15, 23, 42, 0.08);
  }

  header {
    border-bottom: 2px solid #f1f5f9;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }

  header h1 {
    font-size: 28px;
    margin: 0 0 4px;
    color: #0f172a;
  }

  header p {
    margin: 0;
    color: #475569;
    font-size: 14px;
  }

  .branding {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
  }

  .branding .brand-name {
    font-size: 18px;
    font-weight: 600;
    color: #dc2626;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .brand-logo {
    width: 1in;
    height: 1in;
    object-fit: contain;
  }

  section {
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 20px 24px;
    margin-bottom: 20px;
    background-color: #f8fafc;
  }

  section h2 {
    font-size: 16px;
    margin: 0 0 12px;
    color: #0f172a;
  }

  section p.section-description {
    margin: 0 0 16px;
    font-size: 13px;
    color: #64748b;
  }

  .form-field {
    margin-bottom: 16px;
  }

  .form-field:last-child {
    margin-bottom: 0;
  }

  .field-label {
    display: block;
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 6px;
  }

  .field-helper {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 6px;
  }

  .input-line {
    width: 100%;
    border-bottom: 1px solid #94a3b8;
    height: 20px;
  }

  .long-input {
    border: 1px solid #cbd5f5;
    border-radius: 12px;
    height: 120px;
    background: #ffffff;
  }

  .checkbox-line {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .checkbox-box {
    width: 18px;
    height: 18px;
    border: 1px solid #94a3b8;
    border-radius: 4px;
  }

  table.form-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 14px;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e2e8f0;
  }

  table.form-table thead {
    background: #dc2626;
    color: #ffffff;
  }

  table.form-table th,
  table.form-table td {
    border: 1px solid #e2e8f0;
    padding: 10px 12px;
    font-size: 12px;
    text-align: left;
  }

  table.form-table td {
    height: 32px;
  }

  .signature-line {
    margin-top: 24px;
    border-bottom: 1px solid #94a3b8;
    width: 240px;
  }

  .signature-label {
    margin-top: 6px;
    font-size: 12px;
    color: #475569;
  }

  footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px dashed #e2e8f0;
    font-size: 12px;
    color: #94a3b8;
  }

  @media print {
    body {
      background: #ffffff;
      padding: 0;
    }
    .form-wrapper {
      box-shadow: none;
      border-radius: 0;
    }
    section {
      background: #ffffff;
    }
  }
`

// Tightens spacing so a long operational form still lands on a single
// sheet, front and back. Opt in per template with density: 'compact'.
const compactStyles = `
  @page {
    size: letter;
    margin: 0.35in;
  }

  body.density-compact {
    font-size: 11px;
    padding: 12px;
  }

  .density-compact .form-wrapper {
    max-width: none;
    padding: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .density-compact header {
    padding-bottom: 8px;
    margin-bottom: 10px;
  }

  .density-compact header h1 {
    font-size: 19px;
  }

  .density-compact header p {
    font-size: 11px;
  }

  .density-compact section {
    padding: 5px 7px;
    margin-bottom: 4px;
    border-radius: 8px;
  }

  .density-compact .section-row {
    display: flex;
    align-items: stretch;
    gap: 6px;
  }

  .density-compact .section-row > section {
    flex: 1 1 0;
    min-width: 0;
  }

  .density-compact section.section-atomic {
    break-inside: avoid;
  }

  /* Long tables may split across the sheet; repeat the header when they do. */
  .density-compact table.form-table thead {
    display: table-header-group;
  }

  .density-compact section h2 {
    font-size: 13px;
    margin-bottom: 4px;
  }

  .density-compact section p.section-description {
    margin-bottom: 6px;
    font-size: 10px;
  }

  .density-compact .form-field {
    margin-bottom: 6px;
  }

  /* Short inputs sit beside their label instead of stacking. */
  .density-compact .field-inline {
    display: grid;
    grid-template-columns: minmax(90px, 26%) 1fr;
    align-items: center;
    gap: 10px;
  }

  .density-compact .field-inline .field-label {
    margin-bottom: 0;
  }

  .density-compact .input-line {
    height: 15px;
  }

  .density-compact .long-input {
    height: 54px;
  }

  .density-compact .field-helper {
    margin-top: 2px;
    font-size: 9px;
  }

  .density-compact table.form-table {
    border-radius: 6px;
  }

  .density-compact table.form-table th,
  .density-compact table.form-table td {
    padding: 1px 4px;
    font-size: 10px;
  }

  .density-compact table.form-table td {
    height: 15px;
  }

  .density-compact .signature-line {
    margin-top: 12px;
  }

  .density-compact .signature-label {
    margin-top: 3px;
    font-size: 10px;
  }

  .density-compact footer {
    margin-top: 6px;
    padding-top: 4px;
    font-size: 8px;
  }
`

function renderField(field: BusinessFormField): string {
  const helper = field.helperText
    ? `<p class="field-helper">${field.helperText}</p>`
    : ''

  switch (field.type) {
    case 'short-text':
    case 'number':
    case 'date':
      return `
        <div class="form-field field-inline">
          <span class="field-label">${field.label}</span>
          <div class="input-line"></div>
          ${helper}
        </div>
      `
    case 'long-text':
      return `
        <div class="form-field">
          <span class="field-label">${field.label}</span>
          <div class="long-input"></div>
          ${helper}
        </div>
      `
    case 'checkbox':
      return `
        <div class="form-field">
          <div class="checkbox-line">
            <div class="checkbox-box"></div>
            <span class="field-label">${field.label}</span>
          </div>
          ${helper}
        </div>
      `
    case 'signature':
      return `
        <div class="form-field">
          <span class="field-label">${field.label}</span>
          <div class="signature-line"></div>
          <div class="signature-label">Sign above</div>
        </div>
      `
    case 'table': {
      const columns = field.columns ?? []
      const presetRows = field.rows ?? []
      const blankRows = Math.max((field.defaultRows ?? 6) - presetRows.length, 0)
      const cellStyle = field.rowHeight ? ` style="height: ${field.rowHeight}px"` : ''
      const row = (cells: string[]) =>
        `<tr>${columns.map((_, index) => `<td${cellStyle}>${cells[index] ?? ''}</td>`).join('')}</tr>`

      return `
        <div class="form-field">
          <span class="field-label">${field.label}</span>
          <table class="form-table">
            <thead>
              <tr>
                ${columns.map((col) => `<th>${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${presetRows.map(row).join('')}
              ${Array.from({ length: blankRows })
                .map(() => row([]))
                .join('')}
            </tbody>
          </table>
          ${helper}
        </div>
      `
    }
    default:
      return ''
  }
}

function renderSection(section: BusinessFormSection): string {
  const description = section.description
    ? `<p class="section-description">${section.description}</p>`
    : ''

  // Tables are free to break across pages; anything shorter should stay whole.
  const atomic = section.fields.every((field) => field.type !== 'table')

  return `
    <section${atomic ? ' class="section-atomic"' : ''}>
      <h2>${section.label}</h2>
      ${description}
      ${section.fields.map(renderField).join('')}
    </section>
  `
}

// Consecutive sections sharing a columnGroup print side by side, which is how
// a dense operational form claws back the vertical space to fit one page.
function groupSections(sections: BusinessFormSection[]): BusinessFormSection[][] {
  const groups: BusinessFormSection[][] = []

  sections.forEach((section) => {
    const previous = groups[groups.length - 1]
    if (section.columnGroup && previous?.[0]?.columnGroup === section.columnGroup) {
      previous.push(section)
    } else {
      groups.push([section])
    }
  })

  return groups
}

export function renderFormHtml(template: BusinessFormTemplate, options: RenderOptions = {}): string {
  const { title, includeSections, includeBranding = true, notes } = options

  const selectedSections = template.sections.filter((section) => {
    if (!includeSections || includeSections.length === 0) {
      return section.defaultIncluded !== false
    }
    return includeSections.includes(section.id)
  })

  const today = new Date().toLocaleDateString()

  const isCompact = template.density === 'compact'

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title ?? template.name}</title>
        <style>${baseStyles}${isCompact ? compactStyles : ''}</style>
      </head>
      <body class="${isCompact ? 'density-compact' : ''}">
        <div class="form-wrapper">
          <header>
            <div class="branding">
              <div style="display: flex; align-items: center; gap: 16px;">
                ${
                  includeBranding
                    ? `<img src="${formLogoDataUri}" alt="Jose Madrid Salsa Logo" class="brand-logo" />`
                    : ''
                }
                <div>
                  ${
                    includeBranding
                      ? `<div class="brand-name" style="font-size: 14px; margin-bottom: 4px;">Jose Madrid Salsa</div>`
                      : ''
                  }
                  <h1>${title ?? template.name}</h1>
                  <p>${template.description}</p>
                </div>
              </div>
            </div>
          </header>
          ${groupSections(selectedSections)
            .map((group) =>
              group.length > 1
                ? `<div class="section-row">${group.map(renderSection).join('')}</div>`
                : renderSection(group[0]),
            )
            .join('')}
          ${
            notes
              ? `<section><h2>Notes</h2><div class="long-input"></div><p class="field-helper">${notes}</p></section>`
              : ''
          }
          <footer>
            Printable form generated ${today} • Need edits? Visit josemadridsalsa.com/admin/forms
          </footer>
        </div>
      </body>
    </html>
  `
}
