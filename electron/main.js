const { app, BrowserWindow } = require('electron')
const { createServer } = require('http')
const path = require('path')

const PORT = 3721

app.whenReady().then(async () => {
  const appDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..')

  // Load Next.js as a library (no child process needed)
  const next = require(path.join(appDir, 'node_modules', 'next'))
  const nextApp = next.default({ dev: false, dir: appDir })
  const handle = nextApp.getRequestHandler()

  await nextApp.prepare()

  await new Promise((resolve) => {
    createServer((req, res) => handle(req, res)).listen(PORT, '127.0.0.1', resolve)
  })

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Map Creator – Agence Moove',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL(`http://127.0.0.1:${PORT}`)
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
