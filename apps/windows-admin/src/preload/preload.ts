import { contextBridge, ipcRenderer } from 'electron'

/**
 * The only bridge between the app's own pages (the offline notice and the server
 * settings form) and the main process. The admin panel itself never uses this —
 * it is a normal web page and stays one.
 */
/**
 * A read-only marker the desktop shell reads to lay its title bar out.
 *
 * The window is frameless with a title-bar overlay, so Windows paints the
 * minimise/maximise/close buttons over the top-right of the page and the shell
 * has to keep that corner clear. Unlike `desktop` below, this is safe for any
 * page on the origin to see: it says nothing except how the window is framed.
 */
contextBridge.exposeInMainWorld('jmsDesktop', {
  platform: process.platform,
  chrome: 'overlay',
})

contextBridge.exposeInMainWorld('desktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveEndpoint: (endpoint: string) => ipcRenderer.invoke('settings:save', endpoint),
  retry: () => ipcRenderer.invoke('window:retry'),
  openSettings: () => ipcRenderer.invoke('window:open-settings'),
  closeSettings: () => ipcRenderer.invoke('window:close-settings'),
})
