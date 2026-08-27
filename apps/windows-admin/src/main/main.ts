import { BrowserWindow, Menu, app, ipcMain, session, shell } from 'electron'
import { join } from 'node:path'
import { isSafeExternalUrl, shouldOpenInApp, validateEndpoint } from '../shared/endpoint'
import { stripAppTokens } from '../shared/user-agent'
import { readSettings, writeSettings, type DesktopSettings } from './settings-store'
import { registerDownloadHandling } from './downloads'
import { buildApplicationMenu } from './menu'
import { initialiseUpdates } from './updates'

const PRELOAD = join(__dirname, '../preload/preload.js')
const RENDERER_DIR = join(__dirname, '../renderer')

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let settings: DesktopSettings = { endpoint: '', zoomFactor: 1 }

/**
 * Permissions the admin panel legitimately asks for. Everything else — camera,
 * microphone, geolocation, USB — is denied, because nothing in the admin needs
 * it and a hardened window should not be a softer target than a browser tab.
 */
const ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen'])

function loadEndpoint(window: BrowserWindow, url = settings.endpoint): void {
  window.loadURL(url).catch(() => {
    /* did-fail-load renders the offline page */
  })
}

function showOfflinePage(window: BrowserWindow, description: string, url: string): void {
  void window.loadFile(join(RENDERER_DIR, 'offline.html'), {
    query: { reason: description, target: url },
  })
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b0b0c',
    title: 'Jose Madrid Salsa Admin',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  window.once('ready-to-show', () => {
    window.webContents.setZoomFactor(settings.zoomFactor)
    window.show()
  })

  // Keep the app on its own origin and its sign-in providers. Anything else
  // opens in the default browser, so a Stripe dashboard link or a customer's
  // site never inherits this window's session or its relaxed window chrome.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenInApp(settings.endpoint, url)) {
      loadEndpoint(window, url)
    } else if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (shouldOpenInApp(settings.endpoint, url)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
  })

  window.webContents.on('did-fail-load', (_event, errorCode, description, validatedURL, isMainFrame) => {
    // -3 is ERR_ABORTED, which a redirect or a cancelled navigation raises routinely.
    if (!isMainFrame || errorCode === -3) return
    showOfflinePage(window, description || `Error ${errorCode}`, validatedURL || settings.endpoint)
  })

  // The View menu's zoom roles change the factor without emitting
  // 'zoom-changed' — that only fires for ctrl+wheel — so read it on the way out
  // rather than trusting the event to have told us.
  window.on('close', () => {
    if (window.isDestroyed()) return
    settings = { ...settings, zoomFactor: window.webContents.getZoomFactor() }
    writeSettings(settings)
  })

  window.on('closed', () => {
    mainWindow = null
  })

  return window
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 380,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Server Settings',
    parent: mainWindow ?? undefined,
    modal: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0c',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  settingsWindow.setMenu(null)
  void settingsWindow.loadFile(join(RENDERER_DIR, 'settings.html'))
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function applyMenu(window: BrowserWindow): void {
  Menu.setApplicationMenu(
    buildApplicationMenu(window, {
      openSettings: openSettingsWindow,
      reload: () => {
        // Reloading the offline page would just reload the offline page.
        if (window.webContents.getURL().startsWith('file://')) {
          loadEndpoint(window)
        } else {
          window.webContents.reload()
        }
      },
      navigate: (url) => loadEndpoint(window, url),
      currentEndpoint: () => settings.endpoint,
      currentUrl: () => {
        const url = window.webContents.getURL()
        return url.startsWith('file://') ? settings.endpoint : url
      },
    })
  )
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => ({
    ...settings,
    version: app.getVersion(),
    platform: process.platform,
  }))

  ipcMain.handle('settings:save', (_event, endpoint: unknown) => {
    if (typeof endpoint !== 'string') return { error: 'Enter an admin URL.' }

    const result = validateEndpoint(endpoint)
    if ('error' in result) return result

    settings = { ...settings, endpoint: result.url }
    writeSettings(settings)

    if (mainWindow && !mainWindow.isDestroyed()) {
      loadEndpoint(mainWindow)
      applyMenu(mainWindow)
    }

    return { url: result.url }
  })

  ipcMain.handle('window:retry', () => {
    if (mainWindow && !mainWindow.isDestroyed()) loadEndpoint(mainWindow)
  })

  ipcMain.handle('window:open-settings', () => openSettingsWindow())

  ipcMain.handle('window:close-settings', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close()
  })
}

// A second launch should raise the window that is already signed in, not open a
// rival one that fights it for the session cookie.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    settings = readSettings()

    // Google and GitHub refuse to serve their sign-in pages to anything that
    // looks like an embedded webview, and the default string announces both the
    // Electron version and the app name. Present as the Chrome build underneath.
    app.userAgentFallback = stripAppTokens(app.userAgentFallback, app.getName())

    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission))
    })
    registerDownloadHandling(session.defaultSession)
    registerIpc()

    mainWindow = createMainWindow()
    applyMenu(mainWindow)
    loadEndpoint(mainWindow)
    initialiseUpdates(mainWindow)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
        applyMenu(mainWindow)
        loadEndpoint(mainWindow)
      }
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
