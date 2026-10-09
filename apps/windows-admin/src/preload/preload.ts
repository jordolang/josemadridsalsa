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
 * page to see: it says how the window is framed, and its two calls are
 * checked on the other side of the bridge.
 */
contextBridge.exposeInMainWorld('jmsDesktop', {
  platform: process.platform,
  chrome: 'overlay',
  // A notification and the taskbar badge. The main process takes these only
  // from the admin server's top frame and checks every field, so a page that
  // is not the admin — a sign-in provider — gets nowhere by calling them.
  notify: (alert: unknown) => ipcRenderer.send('desktop:notify', alert),
  setBadge: (count: unknown) => ipcRenderer.send('desktop:badge', count),
  printLabel: (url: unknown) => ipcRenderer.send('desktop:print-label', url),
  printReceipt: (job: unknown) => ipcRenderer.send('desktop:print-receipt', job),
  printDocument: (html: unknown) => ipcRenderer.send('desktop:print-document', html),
})

contextBridge.exposeInMainWorld('desktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveEndpoint: (endpoint: string) => ipcRenderer.invoke('settings:save', endpoint),
  retry: () => ipcRenderer.invoke('window:retry'),
  openSettings: () => ipcRenderer.invoke('window:open-settings'),
  closeSettings: () => ipcRenderer.invoke('window:close-settings'),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  saveLabelPrinter: (name: string) => ipcRenderer.invoke('settings:label-printer', name),
  savePrinting: (printing: unknown) => ipcRenderer.invoke('settings:printing', printing),
  testReceiptPrinter: (printer: unknown) => ipcRenderer.invoke('settings:test-receipt', printer),
})
