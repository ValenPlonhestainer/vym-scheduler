// Cargar .env.local manualmente antes de importar módulos que usan process.env
;(function loadEnv() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path') as typeof import('path')
    const envPath = p.join(__dirname, '..', '..', '.env.local')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const key = t.slice(0, eq).trim()
        const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (key && !process.env[key]) process.env[key] = val
      }
    }
  } catch { /* ignorar */ }
})()

import { app, BrowserWindow, dialog, ipcMain, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
import { createServer } from 'http'
import { parse } from 'url'
import path from 'path'
import fs from 'fs'

console.log('[VyM] main.ts cargado, process.type:', process.type, 'electron:', process.versions.electron)

const PORT = 3721

let mainWindow: BrowserWindow | null = null
let isStartingUp = true
let _updateLogStream: fs.WriteStream | null = null
// Estado del auto-update bufferizado: el renderer puede tardar en montar y
// perderse el evento update-available. Lo guardamos para que lo consulte al cargar.
let pendingUpdate: { stage: 'available'; version: string } | { stage: 'downloaded' } | null = null

function updateLog(msg: string) {
  const line = `[${new Date().toISOString()}] [updater] ${msg}\n`
  _updateLogStream?.write(line)
}

async function startNextServer(logStream: fs.WriteStream): Promise<void> {
  const dir = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar')
    : path.join(__dirname, '..', '..')

  logStream.write(`\n[${new Date().toISOString()}] Iniciando Next.js (in-process)\n`)
  logStream.write(`  dir: ${dir}\n`)
  logStream.write(`  isPackaged: ${app.isPackaged}\n`)

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const nextMod: any = require('next')
  const createNext = typeof nextMod.default === 'function' ? nextMod.default : nextMod
  const nextApp: any = createNext({
    dev: false,
    dir,
    hostname: '127.0.0.1',
    port: PORT,
  })
  const handle = nextApp.getRequestHandler()

  logStream.write(`  Preparando Next.js...\n`)
  await nextApp.prepare()
  logStream.write(`  Next.js preparado, levantando servidor HTTP...\n`)

  await new Promise<void>((resolve, reject) => {
    createServer((req, res) => {
      handle(req, res, parse(req.url!, true))
    })
      .listen(PORT, '127.0.0.1', () => {
        logStream.write(`  Servidor en http://127.0.0.1:${PORT}\n`)
        resolve()
      })
      .on('error', (err: Error) => {
        logStream.write(`  Error al levantar servidor: ${err.message}\n`)
        reject(err)
      })
  })
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'VyM Scheduler',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.loadURL(`http://localhost:${PORT}`)
  mainWindow.once('ready-to-show', () => mainWindow!.show())
  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
    }
  })
}

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const keys = ['vym_prog_semana','vym_prog_asigs','vym_prog_fds','vym_prog_asigsfds','vym_prog_tipo','vym_prog_salaaux']
    mainWindow.webContents.executeJavaScript(
      keys.map(k => `localStorage.removeItem('${k}')`).join(';')
    ).catch(() => {})
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isStartingUp) {
    app.quit()
  }
})

function setupAutoUpdater() {
  // No descargar automáticamente: el usuario confirma desde el popup.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = {
    info: (m: unknown) => updateLog(`info: ${String(m)}`),
    warn: (m: unknown) => updateLog(`warn: ${String(m)}`),
    error: (m: unknown) => updateLog(`error: ${String(m)}`),
    debug: (m: unknown) => updateLog(`debug: ${String(m)}`),
  }

  autoUpdater.on('checking-for-update', () => updateLog('Verificando actualizaciones (GitHub)...'))
  autoUpdater.on('update-not-available', () => updateLog('Sin actualizaciones.'))
  autoUpdater.on('error', (err) => updateLog(`Error en auto-updater: ${err?.message ?? String(err)}`))

  autoUpdater.on('update-available', (info) => {
    updateLog(`Actualización disponible: v${info.version}`)
    pendingUpdate = { stage: 'available', version: info.version }
    mainWindow?.webContents.send('update-available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('download-progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', () => {
    updateLog('Descarga completada, lista para instalar.')
    pendingUpdate = { stage: 'downloaded' }
    mainWindow?.webContents.send('update-downloaded')
  })

  // El renderer consulta esto al montar, por si el evento se emitió antes de
  // que React registrara los listeners (race en el arranque).
  ipcMain.handle('get-update-status', () => pendingUpdate)

  ipcMain.on('confirm-update-download', () => {
    updateLog('Descargando actualización...')
    autoUpdater.downloadUpdate().catch((err: Error) => {
      updateLog(`Error descargando actualización: ${err.message}`)
    })
  })

  ipcMain.on('show-update-notification', () => {
    if (Notification.isSupported()) {
      new Notification({
        title: 'VyM Scheduler',
        body: 'Actualizando el programa... Se reiniciará automáticamente en unos segundos.',
      }).show()
    }
  })

  ipcMain.on('install-update', () => {
    // isSilent=true, isForceRunAfter=true → reinstala en silencio y reabre la app.
    autoUpdater.quitAndInstall(true, true)
  })

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      updateLog(`Error verificando actualizaciones: ${err.message}`)
    })
  }
}

app.whenReady().then(async () => {
  process.env.VYM_USER_DATA = app.getPath('userData')

  const logPath = path.join(app.getPath('userData'), 'startup.log')
  const logStream = fs.createWriteStream(logPath, { flags: 'a' })
  try {
    await startNextServer(logStream)
    await createMainWindow()
    isStartingUp = false
    _updateLogStream = logStream
    setupAutoUpdater()
  } catch (err) {
    logStream.write(`[fatal] ${String(err)}\n`)
    dialog.showErrorBox(
      'Error al iniciar VyM Scheduler',
      `${String(err)}\n\nRevisá el log en:\n${logPath}`
    )
    app.quit()
  }
})
