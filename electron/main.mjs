import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { app, BrowserWindow, Menu, shell } from 'electron'
import log from 'electron-log/main'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDevServer = Boolean(process.env.VITE_DEV_SERVER_URL)
const isDebugBuild = () => !app.isPackaged || app.getName().toLowerCase().includes('debug')

const resolveAsset = (...segments) => path.join(__dirname, '..', ...segments)

const setupLogging = () => {
  log.initialize()
  log.transports.file.level = isDebugBuild() ? 'debug' : 'info'
  log.transports.console.level = isDebugBuild() ? 'debug' : false
  log.info('AngelMark desktop bootstrap')
}

const createMainWindow = async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    autoHideMenuBar: !isDebugBuild(),
    backgroundColor: '#0f141d',
    title: app.getName(),
    webPreferences: {
      preload: resolveAsset('electron', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
    if (isDebugBuild()) {
      window.webContents.openDevTools({ mode: 'detach' })
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const allowedDev = isDevServer && url.startsWith(process.env.VITE_DEV_SERVER_URL ?? '')
    const allowedFile = !isDevServer && url.startsWith('file://')
    if (!allowedDev && !allowedFile) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (isDevServer) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await window.loadFile(resolveAsset('dist', 'index.html'))
  }
}

app.setAppUserModelId('com.angelmark.desktop')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.on('second-instance', () => {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) {
    return
  }

  if (window.isMinimized()) {
    window.restore()
  }
  window.focus()
})

app.whenReady().then(async () => {
  setupLogging()

  if (!isDebugBuild()) {
    Menu.setApplicationMenu(null)
  }

  await createMainWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (error) => {
  log.error('uncaughtException', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection', reason)
})
