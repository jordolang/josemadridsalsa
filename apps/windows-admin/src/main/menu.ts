import { BrowserWindow, Menu, app, shell } from 'electron'
import type { BaseWindow, MenuItemConstructorOptions } from 'electron'
import { ADMIN_SECTION_GROUPS } from '../shared/sections'
import { sectionUrl } from '../shared/endpoint'
import { checkForUpdatesInteractively } from './updates'

/**
 * What the menu can ask of the app. Each action that touches a window is
 * handed the window it is for — the focused one when the item was chosen — so
 * one menu bar drives however many admin windows are open.
 */
export interface MenuActions {
  openSettings: () => void
  newWindow: () => void
  reload: (window: BrowserWindow) => void
  navigate: (window: BrowserWindow, url: string) => void
  currentEndpoint: () => string
  currentUrl: (window: BrowserWindow) => string | undefined
}

/** The admin window a menu click is for, or nothing (say, the settings window had focus). */
function forWindow(run: (window: BrowserWindow) => void) {
  return (_item: unknown, base: BaseWindow | undefined) => {
    if (base instanceof BrowserWindow) run(base)
  }
}

const DOCS_URL = 'https://salsadocs.vercel.app/docs/guides/desktop-apps'

export function buildApplicationMenu(actions: MenuActions): Menu {
  // Separators between the sidebar's own groups, so the menu reads the same way
  // the window does.
  const go: MenuItemConstructorOptions[] = ADMIN_SECTION_GROUPS.flatMap((group, index) => [
    ...(index > 0 ? [{ type: 'separator' } as MenuItemConstructorOptions] : []),
    ...group.sections.map((section) => ({
      label: section.label,
      accelerator: section.accelerator,
      click: forWindow((window) => actions.navigate(window, sectionUrl(actions.currentEndpoint(), section.path))),
    })),
  ])

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        {
          label: 'New Window',
          // Not Ctrl+N: the shell's inspector already binds that to a section jump.
          accelerator: 'CmdOrCtrl+Shift+N',
          click: actions.newWindow,
        },
        {
          label: 'Print…',
          accelerator: 'CmdOrCtrl+P',
          click: forWindow((window) => window.webContents.print({})),
        },
        { type: 'separator' },
        {
          label: 'Server Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: actions.openSettings,
        },
        {
          label: 'Open Current Page in Browser',
          click: forWindow((window) => {
            const url = actions.currentUrl(window)
            if (url) void shell.openExternal(url)
          }),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: forWindow(actions.reload) },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { label: '&Go', submenu: go },
    { label: '&Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => void shell.openExternal(DOCS_URL),
        },
        {
          label: 'Check for Updates…',
          click: () => void checkForUpdatesInteractively(),
        },
        { type: 'separator' },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
