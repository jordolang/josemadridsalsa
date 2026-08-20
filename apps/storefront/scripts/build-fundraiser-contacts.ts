/**
 * Builds the `FundraiserContact` outreach database from every archive source.
 *
 * Sources, in the order they are folded together (see `lib/fundraising/contact-consolidate.ts`
 * for why each is treated the way it is):
 *
 *   1. `ArchivedFundraiser` rows already imported from `03 Fundraisers` — grouped into one
 *      record per organization, with jar and order counts summed across their campaigns.
 *   2. `03 Fundraisers/Constant contact email lists/Fundraiser list.csv` — the coordinator
 *      mailing list, and `completed fundraisers.csv`, a strict subset of it flagged in notes.
 *   3. `03 Fundraisers/email lists/Fundraiser website customers *.csv` — storefront buyers who
 *      supported a group. Imported inactive; they are supporters, not coordinators.
 *
 * Dry run by default. Nothing is written until the summary looks right.
 *
 *   tsx scripts/build-fundraiser-contacts.ts
 *   tsx scripts/build-fundraiser-contacts.ts --commit
 *   tsx scripts/build-fundraiser-contacts.ts --archive ../../Documents --commit
 *
 * Re-running is safe. Rows are keyed on `dedupeKey`, and a second run refreshes only the
 * archive-derived columns (totals, years, provenance) plus contact details that are still
 * blank. `isActive`, `status`, `notes` and the solicitation counters are the admin's, so an
 * import never reverses a toggle or re-arms a contact that was marked do-not-contact.
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

import { parseCsv } from '../lib/csv'
import {
  consolidateArchiveRows,
  mergeListRows,
  type ConsolidatedContact,
  type ListRow,
} from '../lib/fundraising/contact-consolidate'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

const SUBPATH = '03 Fundraisers'

interface Args {
  archive: string
  commit: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = { archive: path.resolve(process.cwd(), '../../Documents'), commit: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--commit') out.commit = true
    else if (argv[i] === '--archive') out.archive = path.resolve(argv[++i] ?? '')
  }
  return out
}

/** Reads a CSV if it is there; a missing list is a warning, not a failure. */
function readCsv(file: string): Record<string, string>[] {
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing, skipped: ${path.basename(file)}`)
    return []
  }
  return parseCsv(fs.readFileSync(file, 'utf8')).rows
}

/** The storefront export records the group a buyer ordered through inside the address blob. */
function fundraisingGroup(addresses: string | undefined): string | null {
  const match = /Fundraising Group name\s*:\s*([^,|]*)/.exec(addresses ?? '')
  return match?.[1]?.trim() || null
}

function collectListRows(archiveRoot: string): ListRow[] {
  const ccDir = path.join(archiveRoot, SUBPATH, 'Constant contact email lists')
  const listsDir = path.join(archiveRoot, SUBPATH, 'email lists')
  const rows: ListRow[] = []

  // The broad coordinator list first, so the "completed" subset lands as an enrichment note
  // on records that already exist rather than as a second set of rows.
  for (const [file, note] of [
    ['Fundraiser list.csv', null],
    ['completed fundraisers.csv', 'completed a fundraiser'],
  ] as const) {
    const full = path.join(ccDir, file)
    for (const row of readCsv(full)) {
      const email = row['Email address']
      if (!email) continue
      rows.push({
        email,
        firstName: row['First name'],
        lastName: row['Last name'],
        sourceFile: `${SUBPATH}/Constant contact email lists/${file}`,
        source: 'CONSTANT_CONTACT',
        note,
      })
    }
  }

  // Filename carries an export date that changes, so match the shape rather than hardcode it.
  const exports = fs.existsSync(listsDir)
    ? fs.readdirSync(listsDir).filter((f) => /website customers.*\.csv$/i.test(f))
    : []
  for (const file of exports) {
    for (const row of readCsv(path.join(listsDir, file))) {
      const email = row['Email']
      if (!email) continue
      rows.push({
        email,
        firstName: row['First Name'],
        lastName: row['Last Name'],
        organizationName: fundraisingGroup(row['Addresses']) ?? row['Company'] ?? null,
        phone: row['Phone'],
        sourceFile: `${SUBPATH}/email lists/${file}`,
        source: 'WEBSITE_EXPORT',
      })
    }
  }

  return rows
}

function summarize(contacts: ConsolidatedContact[]) {
  const bySource = new Map<string, number>()
  for (const c of contacts) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1)

  const mailable = contacts.filter((c) => c.email && c.isActive)
  console.log('\n── Consolidated ────────────────────────────────')
  console.log(`  contacts                ${contacts.length}`)
  for (const [source, count] of [...bySource].sort()) {
    console.log(`    ${source.padEnd(22)}${count}`)
  }
  console.log(`  with an email           ${contacts.filter((c) => c.email).length}`)
  console.log(`  with a phone            ${contacts.filter((c) => c.phone).length}`)
  console.log(`  active and mailable     ${mailable.length}`)
  console.log(`  with campaign history   ${contacts.filter((c) => c.campaignCount > 0).length}`)
  console.log(`  total jars              ${contacts.reduce((n, c) => n + c.totalJars, 0)}`)

  const top = [...contacts].sort((a, b) => b.totalJars - a.totalJars).slice(0, 10)
  console.log('\n  Top organizations by jars')
  for (const c of top) {
    const years = c.years.length ? ` [${c.years.join(', ')}]` : ''
    console.log(
      `    ${String(c.totalJars).padStart(6)}  ${c.organizationName}${years}${c.email ? '' : '  (no email)'}`,
    )
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const batchId = `contacts-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`

  console.log(`Archive root: ${args.archive}`)

  const archiveRows = await prisma.archivedFundraiser.findMany({
    select: {
      organizationName: true,
      year: true,
      orderDate: true,
      submittedBy: true,
      contactEmail: true,
      contactPhone: true,
      totalJars: true,
      orderCount: true,
      formType: true,
      sourceFile: true,
    },
  })
  console.log(`Archived fundraiser files: ${archiveRows.length}`)

  const listRows = collectListRows(args.archive)
  console.log(`Mailing-list rows: ${listRows.length}`)

  const contacts = mergeListRows(consolidateArchiveRows(archiveRows), listRows)
  summarize(contacts)

  if (!args.commit) {
    console.log('\nDry run — nothing written. Re-run with --commit to persist.')
    return
  }

  let created = 0
  let updated = 0
  for (const c of contacts) {
    const existing = await prisma.fundraiserContact.findUnique({
      where: { dedupeKey: c.dedupeKey },
      select: { id: true, email: true, phone: true, contactName: true },
    })

    if (!existing) {
      await prisma.fundraiserContact.create({
        data: {
          dedupeKey: c.dedupeKey,
          organizationName: c.organizationName,
          contactName: c.contactName,
          email: c.email,
          phone: c.phone,
          totalJars: c.totalJars,
          totalOrders: c.totalOrders,
          campaignCount: c.campaignCount,
          firstCampaignAt: c.firstCampaignAt,
          lastCampaignAt: c.lastCampaignAt,
          years: c.years,
          isActive: c.isActive,
          source: c.source,
          sourceFiles: c.sourceFiles,
          notes: c.notes,
          importBatchId: batchId,
        },
      })
      created += 1
      continue
    }

    // Totals and provenance are recomputed from the archive every run, so they are
    // authoritative. Contact details only fill blanks — an admin who corrected an address
    // should not have the archive's stale one put back.
    await prisma.fundraiserContact.update({
      where: { id: existing.id },
      data: {
        totalJars: c.totalJars,
        totalOrders: c.totalOrders,
        campaignCount: c.campaignCount,
        firstCampaignAt: c.firstCampaignAt,
        lastCampaignAt: c.lastCampaignAt,
        years: c.years,
        sourceFiles: c.sourceFiles,
        importBatchId: batchId,
        ...(existing.email ? {} : { email: c.email }),
        ...(existing.phone ? {} : { phone: c.phone }),
        ...(existing.contactName ? {} : { contactName: c.contactName }),
      },
    })
    updated += 1
  }

  console.log(`\nCommitted: ${created} created, ${updated} updated (batch ${batchId}).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
