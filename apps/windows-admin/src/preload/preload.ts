import { contextBridge, ipcRenderer } from 'electron'

/**
 * The only bridge between the app's own pages (the offline notice and the server
 * settings form) and the main process. The admin panel itself never uses this —
 * it is a normal web page and stays one.
 */
contextBridge.exposeInMainWorld('desktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveEndpoint: (endpoint: string) => ipcRenderer.invoke('settings:save', endpoint),
  retry: () => ipcRenderer.invoke('window:retry'),
  openSettings: () => ipcRenderer.invoke('window:open-settings'),
  closeSettings: () => ipcRenderer.invoke('window:close-settings'),
})
