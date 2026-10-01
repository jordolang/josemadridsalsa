import { BrowserWindow, app, dialog, shell } from 'electron'
import type { MessageBoxOptions } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Where a person can fetch the installer by hand. The feed itself is set in
 * electron-builder.yml and goes through the same storefront route, because the
 * repository is private and its GitHub releases answer 404 to an app with no
 * GitHub session.
 */
const DOWNLOAD_URL = 'https://www.josemadrid.net/api/desktop/updates/JoseMadridSalsaAdmin-Setup-latest.exe'

/** A dialog over whichever admin window is in front, or on its own if none is. */
function ask(options: MessageBoxOptions) {
  const window = BrowserWindow.getFocusedWindow()
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
}
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let wiredUp = false

/**
 * Updates come from the build the Desktop Apps workflow publishes to the update
 * feed. The build is unsigned until a certificate is configured, so Windows
 * shows a SmartScreen prompt on first install; updates themselves still apply.
 */
export function initialiseUpdates(): void {
  if (wiredUp || !app.isPackaged) return
  wiredUp = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await ask({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Version ${info.version} is ready to install.`,
      detail: 'The app will restart to finish updating.',
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (error) => {
    // A failed check must never interrupt work — the manual path is still there.
    console.error('[updates] check failed:', error)
  })

  void autoUpdater.checkForUpdates()
  setInterval(() => void autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS)
}

export async function checkForUpdatesInteractively(): Promise<void> {
  if (!app.isPackaged) {
    await ask({
      type: 'info',
      title: 'Updates',
      message: 'Update checks only run in an installed build.',
      detail: 'You are running from source. Installed copies update from the Desktop Apps release.',
    })
    return
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result || result.updateInfo.version === app.getVersion()) {
      await ask({
        type: 'info',
        title: 'Updates',
        message: `You are up to date (version ${app.getVersion()}).`,
      })
    }
  } catch (error) {
    const { response } = await ask({
      type: 'warning',
      buttons: ['Open download page', 'Close'],
      defaultId: 0,
      cancelId: 1,
      title: 'Could not check for updates',
      message: 'The update check could not reach the update server.',
      detail: error instanceof Error ? error.message : String(error),
    })
    if (response === 0) await shell.openExternal(DOWNLOAD_URL)
  }
}
