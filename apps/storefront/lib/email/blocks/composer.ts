import { EmailBlock } from './block-definitions'
import { renderBlock } from './renderer'

export function composeTemplate(
  blocks: EmailBlock[],
  variables: Record<string, any>
): string {
  const content = blocks
    .map((block) => renderBlock(block, variables))
    .join('')

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email</title>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `
}
