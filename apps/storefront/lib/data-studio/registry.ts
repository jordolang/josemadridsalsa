/**
 * Everything the Data Studio knows how to ask about.
 *
 * Client-safe by design: the builder renders its pickers from this registry, so nothing here may
 * import Prisma at value level. Dataset definitions are **data, not behaviour** — no member reaches
 * a database. The mapping from a dataset to the query that answers it lives in `execute.server.ts`,
 * which is server-only.
 *
 * Adding a dataset is a single edit here plus one module under `datasets/`. `registry.test.ts` checks
 * every definition for the mistakes that would otherwise surface as a plausible-looking wrong number:
 * a permission that does not exist, a measure naming a field it never selects, a duplicate id.
 */
import { archivedFundraisersDataset } from './datasets/archived-fundraisers'
import { ledgerDataset } from './datasets/ledger'
import { mileageDataset } from './datasets/mileage'
import { revenueAnchorsDataset } from './datasets/revenue-anchors'
import type { DatasetDef, TimeGrain } from './types'

const YEAR_ONLY: readonly TimeGrain[] = ['year']

export const DATASETS: readonly DatasetDef[] = [
  ledgerDataset,
  revenueAnchorsDataset,
  archivedFundraisersDataset,
  mileageDataset,
]

const BY_ID = new Map<string, DatasetDef>(DATASETS.map((dataset) => [dataset.id, dataset]))

export function getDataset(id: string): DatasetDef | undefined {
  return BY_ID.get(id)
}

export const DATASET_IDS: readonly string[] = DATASETS.map((dataset) => dataset.id)

export const DOMAIN_LABELS: Record<DatasetDef['domain'], string> = {
  financials: 'Financials',
  fundraising: 'Fundraising',
  customers: 'Customers & users',
  operations: 'Operations',
}

/** Datasets the caller may open, given the permissions they hold. Drives the catalog and the picker. */
export function datasetsFor(permissions: readonly string[]): DatasetDef[] {
  return DATASETS.filter((dataset) => permissions.includes(dataset.readPermission))
}

/** Grains this dataset can be bucketed by. A year-axis dataset offers only the year. */
export function grainsFor(dataset: DatasetDef): readonly TimeGrain[] {
  return dataset.timeAxis.kind === 'year' ? YEAR_ONLY : dataset.timeAxis.grains
}
