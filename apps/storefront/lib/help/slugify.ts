/**
 * Heading anchor ids, matching github-slugger (what Fumadocs uses in salsadocs) so
 * links like `/help/returns#our-return--refund-policy` keep working after the move.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}
