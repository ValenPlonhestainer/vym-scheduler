import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import net from 'net'
import { checkLocalLicense, validateAndRenewLicense, getLicensePath } from '../lib/license'

const PORT = 3721

let nextProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

function startNextServer(): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VYM_USER_DATA: app.getPath('userData'),
    PORT: String(PORT),
    NODE_ENV: 'production' as const,
  }

  const isPackaged = app.isPackaged
  const nextBin = isPackaged
    ? path.join(process.resourcesPath, 'node_modules', '.bin', 'next')
    : path.join(__dirname, '..', 'node_modules', '.bin', 'next')

  const appRoot = isPackaged ? process.resourcesPath : path.join(__dirname, '..')

  nextProcess = spawn(
    process.platform === 'win32' ? `${nextBin}.cmd` : nextBin,
    ['start', '--port', String(PORT)],
    { cwd: appRoot, env, stdio: 'pipe' }
  )

  nextProcess!.stdout?.on('data', (d: Buffer) => process.stdout.write(d))
  nextProcess!.stderr?.on('data', (d: Buffer) => process.stderr.write(d))
}

function waitForServer(port: number, maxWaitMs = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    function tryConnect() {
      const sock = net.connect(port, '127.0.0.1')
      sock.on('connect', () => { sock.destroy(); resolve() })
      sock.on('error', () => {
        sock.destroy()
        if (Date.now() - start > maxWaitMs) {
          reject(new Error(`Next.js no respondió en ${maxWaitMs / 1000}s`))
        } else {
          setTimeout(tryConnect, 300)
        }
      })
    }
    tryConnect()
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.loadURL(`http://localhost:${PORT}`)
  mainWindow.once('ready-to-show', () => mainWindow!.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

function createActivationWindow(): Promise<boolean> {
  return new Promise(resolve => {
    const win = new BrowserWindow({
      width: 520,
      height: 440,
      resizable: false,
      title: 'Activación de licencia — VyM Scheduler',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    win.loadFile(path.join(__dirname, '..', 'electron', 'activation.html'))
    win.on('closed', () => resolve(false))

    ipcMain.once('license-activated', () => {
      win.close()
      resolve(true)
    })

    // Manejar intento de activación desde la ventana
    ipcMain.on('activate-token', async (_event, token: string) => {
      const licensePath = getLicensePath()
      const result = await validateAndRenewLicense(token, licensePath)
      win.webContents.send('activation-result', result)
      if (result.ok) {
        ipcMain.emit('license-activated')
      }
    })
  })
}

app.on('before-quit', () => {
  nextProcess?.kill()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    nextProcess?.kill()
    app.quit()
  }
})

app.whenReady().then(async () => {
  // Pasar ruta de datos al proceso Next.js
  process.env.VYM_USER_DATA = app.getPath('userData')

  const licensePath = getLicensePath()
  const licStatus = checkLocalLicense(licensePath)

  if (!licStatus.valid) {
    // Mostrar ventana de activación
    const activated = await createActivationWindow()
    if (!activated) {
      app.quit()
      return
    }
  }

  try {
    startNextServer()
    await waitForServer(PORT)
    await createMainWindow()
  } catch (err) {
    dialog.showErrorBox(
      'Error al iniciar VyM Scheduler',
      String(err)
    )
    app.quit()
  }
})
