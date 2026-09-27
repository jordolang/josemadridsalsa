/**
 * Back up, restore and restyle the BigCommerce storefront theme (main store).
 *
 *   npm run bigcommerce:theme --workspace @jose-madrid/storefront -- status
 *   npm run bigcommerce:theme --workspace @jose-madrid/storefront -- backup
 *   npm run bigcommerce:theme --workspace @jose-madrid/storefront -- restore [backup-folder]
 *   npm run bigcommerce:theme --workspace @jose-madrid/storefront -- apply-checkout-style [backup-folder]
 *
 * `restore` puts the storefront back on the exact theme, style and saved
 * configuration recorded in a backup (default: the oldest, taken before any
 * restyle). `apply-checkout-style` uploads a copy of the backed-up theme whose
 * checkout colours come from bigcommerce-theme/checkout-style.json and switches
 * to it; nothing outside checkout changes.
 *
 * Needs BIGCOMMERCE_STORE_HASH and BIGCOMMERCE_ACCESS_TOKEN (an API account with
 * Themes: modify).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import {
  activateTheme,
  downloadThemeZip,
  getActiveTheme,
  getConfiguration,
  getTheme,
  listThemes,
  matchVariation,
  uploadThemeZip,
  withCheckoutStyle,
  type RestorePoint,
} from '../lib/bigcommerce/themes'

const THEME_DIR = path.resolve(__dirname, '../bigcommerce-theme')
const BACKUPS_DIR = path.join(THEME_DIR, 'backups')
const RESTYLED_NAME = 'Cornerstone — Jose Madrid checkout'

function backupFolder(arg: string | undefined): string {
  if (arg) return path.resolve(arg)
  const folders = readdirSync(BACKUPS_DIR).sort()
  if (!folders.length) throw new Error(`No backups in ${BACKUPS_DIR}; run "backup" first`)
  return path.join(BACKUPS_DIR, folders[0])
}

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T

async function status() {
  const active = await getActiveTheme()
  const theme = await getTheme(active.active_theme_uuid)
  console.log(`Live theme: ${theme.name} (${theme.uuid})`)
  console.log(`Configuration: ${active.active_theme_configuration_uuid}`)
  console.log('Themes in the store:')
  for (const t of await listThemes()) console.log(`  ${t.is_active ? '●' : ' '} ${t.name} (${t.uuid})`)
}

async function backup() {
  const active = await getActiveTheme()
  const theme = await getTheme(active.active_theme_uuid)
  const configuration = await getConfiguration(active.active_theme_uuid, active.active_theme_configuration_uuid)
  const zip = await downloadThemeZip(active.active_theme_uuid)
  const themeConfig = JSON.parse(await (await JSZip.loadAsync(zip)).file('config.json')!.async('string'))
  const variationId = matchVariation(themeConfig, configuration.settings)
  const variation = theme.variations.find((v) => v.external_id === variationId)
  if (!variation) throw new Error('Could not tell which style (variation) the live theme uses')

  const folder = path.join(BACKUPS_DIR, new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(folder, { recursive: true })
  const restorePoint: RestorePoint = {
    theme_uuid: theme.uuid,
    theme_name: theme.name,
    variation_uuid: variation.uuid,
    variation_name: variation.name,
    configuration_uuid: active.active_theme_configuration_uuid,
    version_uuid: active.active_theme_version_uuid,
    captured_at: new Date().toISOString(),
  }
  writeFileSync(path.join(folder, 'restore-point.json'), `${JSON.stringify(restorePoint, null, 2)}\n`)
  writeFileSync(path.join(folder, 'active-theme.json'), `${JSON.stringify({ data: active }, null, 2)}\n`)
  writeFileSync(path.join(folder, 'configuration.json'), `${JSON.stringify({ data: [configuration] }, null, 2)}\n`)
  writeFileSync(path.join(folder, `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-live-theme.zip`), Buffer.from(zip))
  console.log(`Backed up ${theme.name} (${variation.name}) to ${folder}`)
}

async function restore(arg: string | undefined) {
  const folder = backupFolder(arg)
  const point = readJson<RestorePoint>(path.join(folder, 'restore-point.json'))
  await activateTheme(point.variation_uuid, point.configuration_uuid)
  const active = await getActiveTheme()
  const restored =
    active.active_theme_uuid === point.theme_uuid &&
    active.active_theme_configuration_uuid === point.configuration_uuid
  console.log(
    restored
      ? `Restored ${point.theme_name} (${point.variation_name}) with configuration ${point.configuration_uuid}`
      : `BigCommerce reports ${active.active_theme_uuid} / ${active.active_theme_configuration_uuid} — check the admin`,
  )
  if (!restored) process.exit(1)
}

async function applyCheckoutStyle(arg: string | undefined) {
  const folder = backupFolder(arg)
  const point = readJson<RestorePoint>(path.join(folder, 'restore-point.json'))
  const zipFile = readdirSync(folder).find((name) => name.endsWith('.zip'))
  if (!zipFile) throw new Error(`No theme zip in ${folder}`)

  const overrides = Object.fromEntries(
    Object.entries(readJson<Record<string, unknown>>(path.join(THEME_DIR, 'checkout-style.json'))).filter(
      ([key]) => !key.startsWith('_'),
    ),
  )
  const zip = await JSZip.loadAsync(readFileSync(path.join(folder, zipFile)))
  const themeConfig = JSON.parse(await zip.file('config.json')!.async('string'))
  const variationId = point.variation_name.toLowerCase()
  zip.file('config.json', JSON.stringify(withCheckoutStyle(themeConfig, variationId, overrides, RESTYLED_NAME), null, 2))

  const restyled = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  console.log(`Uploading "${RESTYLED_NAME}" (${Object.keys(overrides).length} checkout settings changed)…`)
  const themeUuid = await uploadThemeZip(restyled, 'jose-madrid-checkout.zip')
  const variation = (await getTheme(themeUuid)).variations.find((v) => v.external_id === variationId)
  if (!variation) throw new Error(`The uploaded theme has no ${point.variation_name} style`)

  await activateTheme(variation.uuid)
  console.log(`Live: ${RESTYLED_NAME} (${variation.name}). Undo with: npm run bigcommerce:theme -- restore`)
}

const [command, arg] = process.argv.slice(2)
const commands: Record<string, (arg?: string) => Promise<void>> = {
  status,
  backup,
  restore,
  'apply-checkout-style': applyCheckoutStyle,
}

const run = commands[command ?? '']
if (!run) {
  console.error('Usage: bigcommerce-theme <status|backup|restore [folder]|apply-checkout-style [folder]>')
  process.exit(1)
}
run(arg).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
