import { EmailBlock } from './block-definitions'

export function validateBlock(block: EmailBlock): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!block.id) {
    errors.push('Block is missing an id.')
  }
  if (!block.name) {
    errors.push('Block is missing a name.')
  }
  if (!block.category) {
    errors.push('Block is missing a category.')
  }
  if (!block.html) {
    errors.push('Block is missing html.')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
