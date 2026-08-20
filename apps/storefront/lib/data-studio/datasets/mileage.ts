/**
 * Mileage logged for shows, markets and errands — 2,624 trips recovered from the driver spreadsheets.
 *
 * `tripDate` is non-null, so unlike the other archive datasets this one has a genuine timestamp axis
 * and supports every grain. `miles` and `sales` are both nullable, and both blanks mean "the sheet
 * did not record it" rather than zero, so they carry a coverage count.
 */
import type { DatasetDef } from '../types'

export const mileageDataset: DatasetDef = {
  id: 'mileage',
  label: 'Mileage log',
  description:
    'Trips from the driver mileage sheets: miles, destination, driver and any booth sales recorded alongside.',
  domain: 'operations',
  basis: 'operational',
  readPermission: 'analytics:read',
  exportPermission: 'analytics:export',
  timeAxis: {
    kind: 'timestamp',
    field: 'tripDate',
    label: 'Trip date',
    grains: ['day', 'week', 'month', 'quarter', 'year'],
  },
  measures: [
    {
      id: 'miles',
      label: 'Miles',
      unit: 'miles',
      aggregation: 'sum',
      fields: ['miles'],
      nullMeansUnknown: true,
      read: (row) => (typeof row.miles === 'number' ? row.miles : null),
    },
    { id: 'trips', label: 'Trips', unit: 'count', aggregation: 'count', fields: [], read: () => 1 },
    {
      id: 'boothSales',
      label: 'Booth sales',
      unit: 'cents',
      aggregation: 'sum',
      fields: ['sales'],
      nullMeansUnknown: true,
      // Decimal dollars in the column; cents everywhere in this layer. Converting at the dataset
      // boundary is what keeps one figure from being reported 100x out in another report.
      read: (row) => (row.sales === null || row.sales === undefined ? null : Math.round(Number(row.sales) * 100)),
    },
    {
      id: 'averageTrip',
      label: 'Average miles per trip',
      unit: 'miles',
      aggregation: 'avg',
      fields: ['miles'],
      nullMeansUnknown: true,
      read: (row) => (typeof row.miles === 'number' ? row.miles : null),
    },
  ],
  dimensions: [
    {
      id: 'category',
      label: 'Trip type',
      field: 'category',
      values: ['SHOW', 'FARMERS_MARKET', 'FUNDRAISER', 'VENDOR', 'ERRAND', 'MISC'],
      labels: {
        SHOW: 'Show',
        FARMERS_MARKET: "Farmers' market",
        FUNDRAISER: 'Fundraiser',
        VENDOR: 'Vendor',
        ERRAND: 'Errand',
        MISC: 'Other',
      },
      unknownLabel: 'Undetermined',
    },
    { id: 'driver', label: 'Driver', field: 'driver', unknownLabel: 'Not recorded' },
    { id: 'state', label: 'State', field: 'state', unknownLabel: 'Not recorded' },
    { id: 'destination', label: 'Destination', field: 'destination' },
  ],
  filters: [
    {
      id: 'category',
      label: 'Trip type',
      field: 'category',
      ops: ['eq', 'in', 'isNull', 'notNull'],
      values: ['SHOW', 'FARMERS_MARKET', 'FUNDRAISER', 'VENDOR', 'ERRAND', 'MISC'],
    },
    { id: 'driver', label: 'Driver', field: 'driver', ops: ['eq', 'contains'] },
    { id: 'state', label: 'State', field: 'state', ops: ['eq'] },
    { id: 'destination', label: 'Destination', field: 'destination', ops: ['contains'] },
  ],
  rowCap: 20_000,
}
