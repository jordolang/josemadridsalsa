import { EmailBlock, BlockVariable } from './block-definitions'

function replaceVariable(
  html: string,
  variable: BlockVariable,
  value: any
): string {
  const regex = new RegExp(`{{${variable.key}}}`, 'g')
  return html.replace(regex, value)
}

export function renderBlock(
  block: EmailBlock,
  props: Record<string, any>
): string {
  let html = block.html

  for (const key in block.variables) {
    const variable = block.variables[key]
    const value = props[key] || variable.fallback
    html = replaceVariable(html, variable, value)
  }

  return html
}
