import { app, dialog, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

const RELEASES_URL = 'https://github.com/jordolang/josemadridsalsa/releases'
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let wiredUp = false

/**
 * Updates come from the GitHub release the CI workflow publishes. The build is
 * unsigned for now, so Windows shows a SmartScreen prompt on first install;
 * updates themselves still apply, and the manual path stays available for when
 * the automatic check cannot reach GitHub.
 */
export function initialiseUpdates(window: BrowserWindow): void {
  if (wiredUp || !app.isPackaged) return
  wiredUp = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox(window, {
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

export async function checkForUpdatesInteractively(window: BrowserWindow): Promise<void> {
  if (!app.isPackaged) {
    await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Updates',
      message: 'Update checks only run in an installed build.',
      detail: `You are running from source. Releases are published at ${RELEASES_URL}.`,
    })
    return
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result || result.updateInfo.version === app.getVersion()) {
      await dialog.showMessageBox(window, {
        type: 'info',
        title: 'Updates',
        message: `You are up to date (version ${app.getVersion()}).`,
      })
    }
  } catch (error) {
    const { response } = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['Open releases page', 'Close'],
      defaultId: 0,
      cancelId: 1,
      title: 'Could not check for updates',
      message: 'The update check could not reach GitHub.',
      detail: error instanceof Error ? error.message : String(error),
    })
    if (response === 0) await shell.openExternal(RELEASES_URL)
  }
}
