/**
 * Repair email HTML already stored in the database.
 *
 *   npm run email:repair-images                # dry run — reports every row it would change
 *   npm run email:repair-images -- --apply     # write the changes
 *
 * Stored email HTML is a snapshot taken when a template was seeded or saved in the
 * admin panel, so fixing the source templates does not fix rows already written.
 * Two faults are repaired:
 *
 *   1. Filenames that never existed in public/email-templates (a 404, which every
 *      email client renders as a broken-image placeholder).
 *   2. The retired josemadridsalsa.com BigCommerce origin, which serves 404 for the
 *      whole /email-templates path.
 *
 * The stored footer is also swapped for the current one, which fixes the link
 * labels that broke mid-word on narrow screens. Re-seeding with
 * `npm run db:seed:email-templates` would do that too, but it replaces the whole
 * template and discards any edit made in the admin panel; this rewrites only the
 * image URLs and the footer, so admin edits to the body survive.
 *
 * Re-running is safe: every repair is a no-op once applied.
 */

import { PrismaClient } from '@prisma/client'
import { repairEmailHtml } from '../lib/email/shared/image-repair'

const prisma = new PrismaClient()

interface Repair {
  table: string
  id: string
  label: string
  html: string
}

async function collect(): Promise<Repair[]> {
  const [templates, versions, leadTemplates] = await Promise.all([
    prisma.emailTemplate.findMany({ select: { id: true, key: true, html: true, text: true } }),
    prisma.emailTemplateVersion.findMany({ select: { id: true, name: true, version: true, html: true } }),
    prisma.leadEmailTemplate.findMany({ select: { id: true, name: true, htmlContent: true } }),
  ])

  const repairs: Repair[] = []
  const add = (table: string, id: string, label: string, original: string | null) => {
    if (!original) return
    const html = repairEmailHtml(original)
    if (html !== original) repairs.push({ table, id, label, html })
  }

  for (const t of templates) add('EmailTemplate.html', t.id, t.key, t.html)
  for (const v of versions) add('EmailTemplateVersion.html', v.id, `${v.name} v${v.version}`, v.html)
  for (const l of leadTemplates) add('LeadEmailTemplate.htmlContent', l.id, l.name, l.htmlContent)

  return repairs
}

async function main() {
  const apply = process.argv.includes('--apply')
  const repairs = await collect()

  if (repairs.length === 0) {
    console.log('✅ No stored email HTML references a broken image.')
    return
  }

  console.log(`${apply ? '🔧 Repairing' : '🔍 Would repair'} ${repairs.length} row(s):\n`)
  for (const { table, label } of repairs) {
    console.log(`  ${table.padEnd(32)} ${label}`)
  }

  if (!apply) {
    console.log('\nDry run — re-run with --apply to write these changes.')
    return
  }

  for (const { table, id, html } of repairs) {
    if (table === 'EmailTemplate.html') {
      await prisma.emailTemplate.update({ where: { id }, data: { html } })
    } else if (table === 'EmailTemplateVersion.html') {
      await prisma.emailTemplateVersion.update({ where: { id }, data: { html } })
    } else {
      await prisma.leadEmailTemplate.update({ where: { id }, data: { htmlContent: html } })
    }
  }

  console.log(`\n✅ Repaired ${repairs.length} row(s).`)
}

main()
  .catch((e) => {
    console.error('❌ Error repairing email template images:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
