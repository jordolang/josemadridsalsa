import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_ENDPOINT, migrateLegacyDefault, validateEndpoint } from '../shared/endpoint'

export interface DesktopSettings {
  endpoint: string
  zoomFactor: number
}

const DEFAULTS: DesktopSettings = {
  endpoint: DEFAULT_ENDPOINT,
  zoomFactor: 1,
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/**
 * Settings are a convenience, never a dependency: a missing, unreadable or
 * hand-edited file falls back to the defaults rather than stopping the app from
 * opening. A stored endpoint is re-validated on read, so editing the file by
 * hand cannot point the app somewhere it would refuse to be pointed in the UI.
 */
export function readSettings(): DesktopSettings {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<DesktopSettings>
    const endpoint =
      typeof raw.endpoint === 'string' ? validateEndpoint(raw.endpoint) : { error: 'missing' }
    const zoomFactor =
      typeof raw.zoomFactor === 'number' && raw.zoomFactor >= 0.5 && raw.zoomFactor <= 3
        ? raw.zoomFactor
        : DEFAULTS.zoomFactor

    return {
      endpoint: 'url' in endpoint ? migrateLegacyDefault(endpoint.url) : DEFAULTS.endpoint,
      zoomFactor,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(settings: DesktopSettings): void {
  try {
    const path = settingsPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8')
  } catch (error) {
    console.error('[settings] could not be saved:', error)
  }
}
