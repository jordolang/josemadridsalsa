// @ts-ignore
const locations = require('./parse-locations.js');
import { importLocations } from '../lib/locations/import.js';

async function main() {
  const locs = locations as any[];
  console.log(`Importing ${locs.length} locations...`);
  const result = await importLocations(locs);
  console.log('Import result:', result);
}

main().catch(console.error);