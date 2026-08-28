import { Menu, app, shell } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { ADMIN_SECTION_GROUPS } from '../shared/sections'
import { sectionUrl } from '../shared/endpoint'
import { checkForUpdatesInteractively } from './updates'

export interface MenuActions {
  openSettings: () => void
  reload: () => void
  navigate: (url: string) => void
  currentEndpoint: () => string
  currentUrl: () => string | undefined
}

const DOCS_URL = 'https://github.com/jordolang/josemadridsalsa'

export function buildApplicationMenu(window: BrowserWindow, actions: MenuActions): Menu {
  // Separators between the sidebar's own groups, so the menu reads the same way
  // the window does.
  const go: MenuItemConstructorOptions[] = ADMIN_SECTION_GROUPS.flatMap((group, index) => [
    ...(index > 0 ? [{ type: 'separator' } as MenuItemConstructorOptions] : []),
    ...group.sections.map((section) => ({
      label: section.label,
      accelerator: section.accelerator,
      click: () => actions.navigate(sectionUrl(actions.currentEndpoint(), section.path)),
    })),
  ])

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        {
          label: 'Print…',
          accelerator: 'CmdOrCtrl+P',
          click: () => window.webContents.print({}),
        },
        { type: 'separator' },
        {
          label: 'Server Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: actions.openSettings,
        },
        {
          label: 'Open Current Page in Browser',
          click: () => {
            const url = actions.currentUrl()
            if (url) void shell.openExternal(url)
          },
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
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: actions.reload },
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
          click: () => void checkForUpdatesInteractively(window),
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
