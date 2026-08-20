/**
 * Fifteen years of fundraiser history from the document archive.
 *
 * This is the richest time series the business has — 930 campaigns from 2011 to 2026 — and the
 * dataset most likely to be charted wrongly, for two reasons worth stating in code:
 *
 * 1. **The axis must be `year`, not a timestamp.** `orderDate` is nullable and `importedAt` is the
 *    moment the archive was ingested. Bucketing on `importedAt` would draw one enormous spike on the
 *    day of the import and call it fifteen years of fundraising.
 * 2. **There is no revenue measure, deliberately.** `ArchivedFundraiser` records jars, not dollars,
 *    because the per-jar price varied across eras and no source form carries a line total. Inventing
 *    a dollar figure by multiplying by today's price would produce a number that looks authoritative
 *    and is not. Jars are the honest measure; revenue belongs to the ledger and to filed summaries.
 */
import type { DatasetDef } from '../types'

const readInt = (field: string) => (row: Record<string, unknown>): number | null =>
  typeof row[field] === 'number' ? (row[field] as number) : null

export const archivedFundraisersDataset: DatasetDef = {
  id: 'archived-fundraisers',
  label: 'Fundraiser history (archive)',
  description:
    'Campaigns recovered from the paper and spreadsheet archive, 2011 onwards. Measured in jars — the source forms record no dollar totals.',
  domain: 'fundraising',
  basis: 'operational',
  readPermission: 'content:read',
  exportPermission: 'analytics:export',
  timeAxis: { kind: 'year', field: 'year', label: 'Year' },
  measures: [
    {
      id: 'jars',
      label: 'Jars',
      unit: 'jars',
      aggregation: 'sum',
      fields: ['totalJars'],
      // Nullable in the source: some forms record a jar count, some do not. A blank is a gap in the
      // paperwork, not a campaign that sold nothing.
      nullMeansUnknown: true,
      read: readInt('totalJars'),
    },
    {
      id: 'orders',
      label: 'Orders on the form',
      unit: 'count',
      aggregation: 'sum',
      fields: ['orderCount'],
      nullMeansUnknown: true,
      read: readInt('orderCount'),
    },
    { id: 'campaigns', label: 'Campaigns', unit: 'count', aggregation: 'count', fields: [], read: () => 1 },
    {
      id: 'organisations',
      label: 'Distinct organisations',
      unit: 'count',
      aggregation: 'countDistinct',
      fields: ['organizationName'],
      read: (row) => (typeof row.organizationName === 'string' ? row.organizationName.length : null),
    },
    {
      id: 'averageJars',
      label: 'Average jars per campaign',
      unit: 'jars',
      aggregation: 'avg',
      fields: ['totalJars'],
      nullMeansUnknown: true,
      read: readInt('totalJars'),
    },
  ],
  dimensions: [
    {
      id: 'formType',
      label: 'Form type',
      field: 'formType',
      values: ['ORDER_EXPORT', 'ORDER_FORM', 'UNKNOWN'],
      labels: { ORDER_EXPORT: 'Website export', ORDER_FORM: 'Paper order form', UNKNOWN: 'Unclassified' },
    },
    { id: 'organizationName', label: 'Organisation', field: 'organizationName', unknownLabel: 'Unnamed' },
    { id: 'submittedBy', label: 'Submitted by', field: 'submittedBy', unknownLabel: 'Not recorded' },
  ],
  filters: [
    {
      id: 'formType',
      label: 'Form type',
      field: 'formType',
      ops: ['eq', 'in', 'neq'],
      values: ['ORDER_EXPORT', 'ORDER_FORM', 'UNKNOWN'],
    },
    { id: 'organizationName', label: 'Organisation', field: 'organizationName', ops: ['contains'] },
    { id: 'submittedBy', label: 'Submitted by', field: 'submittedBy', ops: ['contains'] },
  ],
  rowCap: 20_000,
  emptyStateNote:
    'Populated by the document-archive import. Jar counts are the only measure the source forms support — there is no dollar revenue to chart here.',
}
