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
})
