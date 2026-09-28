import { bigCommerceFetch } from './client'
import { getBigCommerceStore } from './config'

/**
 * The BigCommerce storefront theme (main store, channel 1): backing it up,
 * restoring it, and restyling its checkout to match this site.
 *
 * BigCommerce's checkout takes its look from `optimizedCheckout-*` settings in
 * the active theme's configuration. There is no API to save edited settings as
 * a configuration, so a restyle uploads a copy of the live theme whose
 * config.json carries the new checkout settings and activates it; every other
 * setting is the live one, so only the checkout changes. BigCommerce keeps the
 * original theme and all of its saved configurations, which is what `restore`
 * switches back to.
 */

export const STOREFRONT_CHANNEL_ID = 1

/** The prefix of every setting that styles BigCommerce's optimized one-page checkout. */
export const CHECKOUT_SETTING_PREFIX = 'optimizedCheckout-'

export type ActiveTheme = {
  active_theme_uuid: string
  active_theme_configuration_uuid: string
  active_theme_version_uuid: string
}

export type ThemeConfiguration = {
  uuid: string
  theme_uuid: string
  version_uuid: string
  settings: Record<string, unknown>
}

type Variation = { uuid: string; name: string; external_id: string }
type Theme = { uuid: string; name: string; is_active: boolean; variations: Variation[] }

/** What `restore` needs to put a theme back exactly as it was. */
export type RestorePoint = {
  theme_uuid: string
  theme_name: string
  variation_uuid: string
  variation_name: string
  configuration_uuid: string
  version_uuid: string
  captured_at: string
}

export async function getActiveTheme(): Promise<ActiveTheme> {
  const res = await bigCommerceFetch<{ data: ActiveTheme }>(
    'main',
    `v3/channels/${STOREFRONT_CHANNEL_ID}/active-theme`,
  )
  return res.data
}

export async function getTheme(themeUuid: string): Promise<Theme> {
  return (await bigCommerceFetch<{ data: Theme }>('main', `v3/themes/${themeUuid}`)).data
}

export async function listThemes(): Promise<Theme[]> {
  return (await bigCommerceFetch<{ data: Theme[] }>('main', 'v3/themes')).data
}

export async function getConfiguration(themeUuid: string, configurationUuid: string): Promise<ThemeConfiguration> {
  const res = await bigCommerceFetch<{ data: ThemeConfiguration[] }>('main', `v3/themes/${themeUuid}/configurations`, {
    query: { 'uuid:in': configurationUuid },
  })
  const configuration = res.data[0]
  if (!configuration) throw new Error(`Theme configuration ${configurationUuid} not found`)
  return configuration
}

/**
 * The variation whose defaults, over the theme's base settings, reproduce
 * `settings`. A configuration does not always record its variation, but
 * activation needs one; the variation that matches every setting is the one
 * the store is running.
 */
export function matchVariation(
  themeConfig: { settings: Record<string, unknown>; variations?: Array<{ id: string; settings?: Record<string, unknown> }> },
  settings: Record<string, unknown>,
): string | null {
  let best: { id: string; matches: number } | null = null
  for (const variation of themeConfig.variations ?? []) {
    const merged = { ...themeConfig.settings, ...(variation.settings ?? {}) }
    const matches = Object.entries(settings).filter(([key, value]) => merged[key] === value).length
    if (!best || matches > best.matches) best = { id: variation.id, matches }
  }
  return best?.id ?? null
}

/**
 * The theme's config.json with the checkout settings replaced in the chosen
 * variation and the theme renamed. Only `optimizedCheckout-*` keys may be
 * overridden, so the storefront outside checkout cannot change.
 */
export function withCheckoutStyle(
  themeConfig: Record<string, unknown> & {
    name: string
    variations: Array<{ id: string; settings?: Record<string, unknown> }>
  },
  variationId: string,
  overrides: Record<string, unknown>,
  themeName: string,
): typeof themeConfig {
  const outside = Object.keys(overrides).filter((key) => !key.startsWith(CHECKOUT_SETTING_PREFIX))
  if (outside.length) {
    throw new Error(`Only checkout settings (${CHECKOUT_SETTING_PREFIX}*) may be restyled; refused: ${outside.join(', ')}`)
  }
  if (!themeConfig.variations.some((variation) => variation.id === variationId)) {
    throw new Error(`The theme has no "${variationId}" variation`)
  }

  return {
    ...themeConfig,
    name: themeName,
    variations: themeConfig.variations.map((variation) =>
      variation.id === variationId
        ? { ...variation, settings: { ...(variation.settings ?? {}), ...overrides } }
        : variation,
    ),
  }
}

/**
 * Switches the storefront to a theme variation. With a configuration the
 * store gets exactly that saved configuration (how `restore` puts back the
 * original); without one it gets the variation's own config.json settings
 * (how a freshly uploaded, restyled theme goes live).
 */
export async function activateTheme(variationUuid: string, configurationUuid?: string): Promise<void> {
  await bigCommerceFetch('main', 'v3/themes/actions/activate', {
    method: 'POST',
    body: configurationUuid
      ? { variation_id: variationUuid, which: 'CLIENT_SUPPLIED', configuration_id: configurationUuid }
      : { variation_id: variationUuid, which: 'ORIGINAL' },
  })
}

type Job = { status: string; result?: { download_url?: string; theme_id?: string }; errors?: unknown[] }

async function waitForJob(jobId: string): Promise<Job> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const job = (await bigCommerceFetch<{ data: Job }>('main', `v3/themes/jobs/${jobId}`)).data
    if (job.status === 'COMPLETED') return job
    if (job.status === 'FAILED') throw new Error(`BigCommerce theme job failed: ${JSON.stringify(job.errors ?? job)}`)
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error(`BigCommerce theme job ${jobId} did not finish`)
}

/** The live theme as the zip BigCommerce itself would restore from. */
export async function downloadThemeZip(themeUuid: string): Promise<ArrayBuffer> {
  const { job_id } = await bigCommerceFetch<{ job_id: string }>('main', `v3/themes/${themeUuid}/actions/download`, {
    method: 'POST',
    body: { which: 'last_activated' },
  })
  const job = await waitForJob(job_id)
  const url = job.result?.download_url
  if (!url) throw new Error('BigCommerce returned no download URL for the theme')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Theme download failed (${res.status})`)
  return res.arrayBuffer()
}

/** Uploads a theme zip as a new theme in "My Themes" and returns its uuid. */
export async function uploadThemeZip(zip: Uint8Array, filename: string): Promise<string> {
  const store = getBigCommerceStore('main')
  const form = new FormData()
  // A copy guarantees an ArrayBuffer-backed view, which Blob requires.
  form.append('file', new Blob([new Uint8Array(zip)], { type: 'application/zip' }), filename)
  const res = await fetch(`https://api.bigcommerce.com/stores/${store.storeHash}/v3/themes`, {
    method: 'POST',
    headers: { 'X-Auth-Token': store.accessToken, Accept: 'application/json' },
    body: form,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Theme upload failed (${res.status}): ${text}`)
  const { job_id } = JSON.parse(text) as { job_id: string }
  const job = await waitForJob(job_id)
  if (!job.result?.theme_id) throw new Error('BigCommerce finished the upload without a theme id')
  return job.result.theme_id
}
