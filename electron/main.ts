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

import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { createServer } from 'http'
import { parse } from 'url'
import path from 'path'
import fs from 'fs'
import https from 'https'
import os from 'os'

console.log('[VyM] main.ts cargado, process.type:', process.type, 'electron:', process.versions.electron)

const PORT = 3721

// Provider de updates en Cloudflare R2 (mismo bucket que electron-updater).
const R2_BASE = 'https://pub-ea9f59664d6d4742a8da9c6c3db561fe.r2.dev'
const LATEST_YML_URL = `${R2_BASE}/latest.yml`
// Página de descargas (Cloudflare Pages). Debe coincidir con el proyecto desplegado.
// El flujo Win7 abre esta página en el navegador del sistema para bajar el .exe.
const DOWNLOAD_PAGE_URL = 'https://vym-scheduler.pages.dev'

let mainWindow: BrowserWindow | null = null
let isStartingUp = true
let _updateLogStream: fs.WriteStream | null = null
// Estado del auto-update bufferizado: el renderer puede tardar en montar y
// perderse el evento update-available. Lo guardamos para que lo consulte al cargar.
let pendingUpdate:
  | { stage: 'available'; version: string }
  | { stage: 'downloaded' }
  | { stage: 'manual'; version: string; downloadUrl: string }
  | null = null

function updateLog(msg: string) {
  const line = `[${new Date().toISOString()}] [updater] ${msg}\n`
  _updateLogStream?.write(line)
}

// Windows 7 = NT 6.1. En Win7 sin parchear el TLS de Chromium no llega a R2,
// así que ese parque usa el flujo híbrido (chequeo por Node https + navegador).
// VYM_FORCE_WIN7=1 fuerza la rama para testear sin un Win7 real.
function isWindows7(): boolean {
  if (process.env.VYM_FORCE_WIN7 === '1') return true
  return process.platform === 'win32' && os.release().startsWith('6.1')
}

// GET por el módulo https de Node (OpenSSL + CA bundle propio, independiente
// del almacén de certificados de Windows). Mismo patrón que lib/license.ts,
// que ya funciona en Win7.
function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET' },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      }
    )
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    req.end()
  })
}

// Compara versiones semver simples (a.b.c). >0 si a>b, <0 si a<b, 0 iguales.
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}

// Chequeo de update para Win7: baja solo latest.yml (chico) por Node https,
// parsea la versión y, si hay una nueva, avisa al renderer para que ofrezca
// abrir la página de descargas en el navegador.
async function checkUpdateWin7(): Promise<void> {
  try {
    updateLog('Verificando actualizaciones (Win7, Node https)...')
    const res = await httpsGet(LATEST_YML_URL, 8000)
    if (res.status < 200 || res.status >= 300) {
      updateLog(`Win7: latest.yml respondió ${res.status}`)
      return
    }
    const m = res.body.match(/^version:\s*(.+)$/m)
    if (!m) {
      updateLog('Win7: no se pudo parsear "version" de latest.yml')
      return
    }
    const remote = m[1].trim().replace(/^["']|["']$/g, '')
    const current = app.getVersion()
    if (compareVersions(remote, current) > 0) {
      updateLog(`Win7: actualización disponible v${remote} (actual v${current})`)
      pendingUpdate = { stage: 'manual', version: remote, downloadUrl: DOWNLOAD_PAGE_URL }
      mainWindow?.webContents.send('update-available-manual', { version: remote, downloadUrl: DOWNLOAD_PAGE_URL })
    } else {
      updateLog(`Win7: sin actualizaciones (remota v${remote}, actual v${current})`)
    }
  } catch (err) {
    updateLog(`Win7: error verificando latest.yml: ${err instanceof Error ? err.message : String(err)}`)
  }
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

  autoUpdater.on('checking-for-update', () => updateLog('Verificando actualizaciones (R2)...'))
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

  // El preload expone getVersion() pero faltaba el handler en main.
  ipcMain.handle('get-version', () => app.getVersion())

  // Flujo Win7: abrir la página de descargas en el navegador del sistema,
  // que sí resuelve el TLS de Cloudflare y baja el .exe.
  ipcMain.on('open-download-page', () => {
    shell.openExternal(DOWNLOAD_PAGE_URL).catch((err: Error) => {
      updateLog(`Error abriendo página de descargas: ${err.message}`)
    })
  })

  // Enfoque A: ramificar por SO ANTES de tocar la red (determinístico, no
  // depende de detectar el fallo silencioso de TLS en Win7).
  // VYM_FORCE_WIN7=1 permite testear el flujo híbrido fuera de package.
  const shouldCheck = app.isPackaged || process.env.VYM_FORCE_WIN7 === '1'
  if (shouldCheck) {
    if (isWindows7()) {
      checkUpdateWin7()
    } else {
      autoUpdater.checkForUpdates().catch((err: Error) => {
        updateLog(`Error verificando actualizaciones: ${err.message}`)
      })
    }
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
