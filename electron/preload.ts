import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Para activación de licencia
  activateToken: (token: string) => ipcRenderer.send('activate-token', token),
  onActivationResult: (cb: (result: { ok: boolean; error?: string }) => void) => {
    ipcRenderer.on('activation-result', (_event, result) => cb(result))
  },
  signalActivated: () => ipcRenderer.emit('license-activated'),

  // Auto-update
  onUpdateAvailable: (cb: (info: { version: string }) => void) => {
    ipcRenderer.on('update-available', (_e, info) => cb(info))
  },
  onDownloadProgress: (cb: (progress: { percent: number }) => void) => {
    ipcRenderer.on('download-progress', (_e, progress) => cb(progress))
  },
  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on('update-downloaded', () => cb())
  },
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  confirmDownload: () => ipcRenderer.send('confirm-update-download'),
  showUpdateNotification: () => ipcRenderer.send('show-update-notification'),
  installUpdate: () => ipcRenderer.send('install-update'),

  // Auto-update híbrido (Win7): aviso en-app + descarga por el navegador.
  onManualUpdateAvailable: (cb: (info: { version: string; downloadUrl: string }) => void) => {
    ipcRenderer.on('update-available-manual', (_e, info) => cb(info))
  },
  openDownloadPage: () => ipcRenderer.send('open-download-page'),
})
