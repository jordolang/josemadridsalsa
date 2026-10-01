import { BrowserWindow, Menu, Notification, app, ipcMain, nativeImage, nativeTheme, session, shell } from 'electron'
import { join } from 'node:path'
import { isInternalUrl, isSafeExternalUrl, shouldOpenInApp, validateEndpoint } from '../shared/endpoint'
import { isRepeat, parseAlert, parseBadge, parseLabelUrl } from '../shared/alerts'
import { stripAppTokens } from '../shared/user-agent'
import { readSettings, writeSettings, type DesktopSettings } from './settings-store'
import { registerDownloadHandling } from './downloads'
import { buildApplicationMenu } from './menu'
import { initialiseUpdates } from './updates'

const PRELOAD = join(__dirname, '../preload/preload.js')
const RENDERER_DIR = join(__dirname, '../renderer')

/** Every open admin window. The first one opened is the one a second launch raises. */
const windows = new Set<BrowserWindow>()
let settingsWindow: BrowserWindow | null = null
let settings: DesktopSettings = { endpoint: '', zoomFactor: 1, labelPrinter: '' }

/**
 * Permissions the admin panel legitimately asks for. Everything else — camera,
 * microphone, geolocation, USB — is denied, because nothing in the admin needs
 * it and a hardened window should not be a softer target than a browser tab.
 */
const ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen'])

/** A 16px red dot laid over the taskbar button while work is waiting. */
const BADGE_DOT = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAb0lEQVR42mO4qavAgAVLAHEkEFdDcSRUDEMtNo1zgfg/DjwX3SBkzRZA/BiPZhh+DFWLYoAEkZqRDZFANmAuCZqRvcMAs/0/mViCARrC5BoQyQCNJnINqKaKARR7geJApDgaqZKQKE7KVMlMZGVnAPqP1nR1QtnnAAAAAElFTkSuQmCC',
)

/** Alerts already shown, so every window announcing the same new order shows it once. */
const shownAlerts = new Map<string, number>()
let badgeCount = 0

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

/** The window an app-level action means: the focused one, else the first still open. */
function activeWindow(): BrowserWindow | undefined {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && windows.has(focused)) return focused
  return windows.values().next().value
}

/**
 * The desktop shell paints its own 44px title bar, so the window is frameless
 * and Windows draws only the minimise/maximise/close buttons over the top-right
 * of the page. The colours have to match the shell's own bar or the buttons sit
 * on a visible patch of the wrong shade, which is why they track the system
 * theme the same way the page does.
 */
const TITLE_BAR_HEIGHT = 44

function titleBarOverlay() {
  const dark = nativeTheme.shouldUseDarkColors
  return {
    color: dark ? '#171210' : '#e7e1db',
    symbolColor: dark ? '#a89e96' : '#6d6158',
    height: TITLE_BAR_HEIGHT,
  }
}

function paintBadge(window: BrowserWindow): void {
  window.setOverlayIcon(badgeCount > 0 ? BADGE_DOT : null, badgeCount > 0 ? `${badgeCount} waiting` : '')
}

/**
 * Open an admin window, at the configured endpoint or at `url` inside it.
 *
 * Any number can be open — orders on one screen, inventory on another — and
 * they share one session, so signing in once signs them all in.
 */
function openWindow(url = settings.endpoint): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#201d1b' : '#f1ede9',
    title: 'Jose Madrid Salsa Admin',
    icon: join(__dirname, '../../build/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarOverlay(),
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // The shell polls its badge counts so a new order can be announced while
      // the window is minimised. Chromium would otherwise slow a hidden page's
      // timers until that poll stopped meaning anything.
      backgroundThrottling: false,
    },
  })
  windows.add(window)

  window.once('ready-to-show', () => {
    window.webContents.setZoomFactor(settings.zoomFactor)
    paintBadge(window)
    window.show()
  })

  const repaintTitleBar = () => {
    if (window.isDestroyed()) return
    window.setTitleBarOverlay(titleBarOverlay())
    window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#201d1b' : '#f1ede9')
  }
  nativeTheme.on('updated', repaintTitleBar)
  window.on('closed', () => nativeTheme.off('updated', repaintTitleBar))

  // Keep the app on its own origin and its sign-in providers. Anything else
  // opens in the default browser, so a Stripe dashboard link or a customer's
  // site never inherits this window's session or its relaxed window chrome.
  // A link the admin opens in a new tab opens a new admin window instead.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isInternalUrl(settings.endpoint, target)) {
      openWindow(target)
    } else if (shouldOpenInApp(settings.endpoint, target)) {
      loadEndpoint(window, target)
    } else if (isSafeExternalUrl(target)) {
      void shell.openExternal(target)
    }
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, target) => {
    if (shouldOpenInApp(settings.endpoint, target)) return
    event.preventDefault()
    if (isSafeExternalUrl(target)) void shell.openExternal(target)
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
    windows.delete(window)
  })

  loadEndpoint(window, url)
  return window
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 470,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Server Settings',
    parent: activeWindow(),
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

function applyMenu(): void {
  Menu.setApplicationMenu(
    buildApplicationMenu({
      openSettings: openSettingsWindow,
      newWindow: () => openWindow(),
      reload: (window) => {
        // Reloading the offline page would just reload the offline page.
        if (window.webContents.getURL().startsWith('file://')) {
          loadEndpoint(window)
        } else {
          window.webContents.reload()
        }
      },
      navigate: (window, url) => loadEndpoint(window, url),
      currentEndpoint: () => settings.endpoint,
      currentUrl: (window) => {
        const url = window.webContents.getURL()
        return url.startsWith('file://') ? settings.endpoint : url
      },
    }),
  )
}

/**
 * The URL of the frame a bridge message came from, or null unless it is the
 * top frame of one of our admin windows. Notifications and the badge are only
 * taken from there — not from a sign-in provider's page, and not from an iframe.
 */
function trustedSender(event: Electron.IpcMainEvent): string | null {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || !windows.has(window)) return null
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return null
  return event.senderFrame.url
}

/** A 4×6 label, in microns — what Electron's `pageSize` takes. */
const LABEL_PAGE = { width: 101_600, height: 152_400 }

function tell(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show()
}

/**
 * Print a shipping label image at 4×6.
 *
 * Drawn in a hidden window of its own, never the admin window, so the label's
 * host gets no session and no bridge. With a label printer set the job goes
 * straight to it; without one the system print dialog opens. The image URL is
 * handed over as data, not spliced into HTML.
 */
async function printLabel(url: string): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    width: 384,
    height: 576,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true },
  })

  try {
    await window.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          '<!doctype html><meta charset="utf-8"><style>@page{size:4in 6in;margin:0}html,body{margin:0}' +
            'img{display:block;width:4in;height:6in;object-fit:contain}</style><img alt="">',
        ),
    )
    const width = (await window.webContents.executeJavaScript(
      `new Promise((resolve) => {
        const img = document.querySelector('img')
        img.onload = () => resolve(img.naturalWidth)
        img.onerror = () => resolve(0)
        img.src = ${JSON.stringify(url)}
      })`,
    )) as number
    if (!width) {
      tell('Label not printed', 'The label image could not be downloaded.')
      return
    }

    const printer = settings.labelPrinter
    await new Promise<void>((resolve) => {
      window.webContents.print(
        {
          silent: Boolean(printer),
          deviceName: printer || undefined,
          margins: { marginType: 'none' },
          pageSize: LABEL_PAGE,
          printBackground: true,
        },
        (ok, reason) => {
          if (!ok && reason !== 'cancelled') {
            tell('Label not printed', printer ? `${printer}: ${reason}` : reason)
          }
          resolve()
        },
      )
    })
  } finally {
    if (!window.isDestroyed()) window.destroy()
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => ({
    ...settings,
    version: app.getVersion(),
    platform: process.platform,
  }))

  ipcMain.handle('settings:save', (event, endpoint: unknown) => {
    // The preload exposes this to every page the window loads, a sign-in
    // provider's included. Only the app's own settings page may repoint it.
    if (!event.senderFrame?.url.startsWith('file://')) return { error: 'Not allowed.' }
    if (typeof endpoint !== 'string') return { error: 'Enter an admin URL.' }

    const result = validateEndpoint(endpoint)
    if ('error' in result) return result

    settings = { ...settings, endpoint: result.url }
    writeSettings(settings)

    for (const window of windows) loadEndpoint(window)
    applyMenu()

    return { url: result.url }
  })

  ipcMain.handle('window:retry', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window && windows.has(window)) loadEndpoint(window)
  })

  ipcMain.handle('window:open-settings', () => openSettingsWindow())

  ipcMain.handle('window:close-settings', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close()
  })

  ipcMain.on('desktop:notify', (event, value: unknown) => {
    const sender = trustedSender(event)
    const alert = sender ? parseAlert(settings.endpoint, sender, value) : null
    if (!alert || !Notification.isSupported() || isRepeat(shownAlerts, alert, Date.now())) return

    const notification = new Notification({ title: alert.title, body: alert.body })
    notification.on('click', () => {
      const window = activeWindow() ?? openWindow()
      if (window.isMinimized()) window.restore()
      window.focus()
      loadEndpoint(window, alert.url)
    })
    notification.show()

    // Flash the taskbar button too, for anyone not watching the corner of the screen.
    for (const window of windows) if (!window.isFocused()) window.flashFrame(true)
  })

  ipcMain.on('desktop:print-label', (event, value: unknown) => {
    const sender = trustedSender(event)
    const url = sender ? parseLabelUrl(settings.endpoint, sender, value) : null
    if (url) void printLabel(url)
  })

  // The printer list and the label-printer choice belong to the settings page
  // only, like the endpoint.
  ipcMain.handle('printers:list', async (event) => {
    if (!event.senderFrame?.url.startsWith('file://')) return []
    const window = activeWindow() ?? settingsWindow
    if (!window) return []
    return (await window.webContents.getPrintersAsync()).map((printer) => printer.name)
  })

  ipcMain.handle('settings:label-printer', (event, name: unknown) => {
    if (!event.senderFrame?.url.startsWith('file://') || typeof name !== 'string') return
    settings = { ...settings, labelPrinter: name.slice(0, 200) }
    writeSettings(settings)
  })

  ipcMain.on('desktop:badge', (event, value: unknown) => {
    const sender = trustedSender(event)
    const count = sender ? parseBadge(settings.endpoint, sender, value) : null
    if (count === null || count === badgeCount) return
    badgeCount = count
    for (const window of windows) paintBadge(window)
  })
}

// A second launch should raise a window that is already signed in, not open a
// rival one. New windows come from the File menu, sharing the one session.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = activeWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.whenReady().then(() => {
    settings = readSettings()

    // Windows attributes toast notifications to an app by this id. The NSIS
    // installer registers the same one, so a toast is "Jose Madrid Salsa Admin"
    // rather than "electron.app.…".
    app.setAppUserModelId('com.josemadridsalsa.admin')

    // Google and GitHub refuse to serve their sign-in pages to anything that
    // looks like an embedded webview, and the default string announces both the
    // Electron version and the app name. Present as the Chrome build underneath.
    app.userAgentFallback = stripAppTokens(app.userAgentFallback, app.getName())

    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission))
    })
    registerDownloadHandling(session.defaultSession)
    registerIpc()

    applyMenu()
    openWindow()
    initialiseUpdates()

    app.on('activate', () => {
      if (windows.size === 0) openWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
