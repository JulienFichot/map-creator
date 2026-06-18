const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const PORT = 3721
let serverProcess = null

// Single-instance lock: if another instance is already running, quit immediately.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

function startServer (appDir) {
  const nextBin = path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next')
  serverProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    cwd: appDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' },
    stdio: 'pipe',
  })
  serverProcess.stderr?.on('data', d => process.stderr.write('[next] ' + d))
  serverProcess.on('error', err => console.error('Server spawn error:', err))
}

function waitForServer (cb) {
  let done = false
  const attempt = () => {
    if (done) return
    const req = http.get(`http://127.0.0.1:${PORT}`, () => {
      if (done) return
      done = true
      cb()
    })
    req.on('error', () => { if (!done) setTimeout(attempt, 300) })
    req.setTimeout(600, () => { req.destroy(); if (!done) setTimeout(attempt, 300) })
  }
  attempt()
}

app.whenReady().then(() => {
  const appDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..')

  const splash = new BrowserWindow({
    width: 420,
    height: 180,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    backgroundColor: '#1e293b',
  })
  splash.loadURL(
    `data:text/html,<!DOCTYPE html><html><body style="background:%231e293b;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:Arial,sans-serif"><p style="color:%23f97316;font-size:22px;font-weight:700;margin:0 0 12px">Map Creator</p><p style="color:%2394a3b8;font-size:14px;margin:0">D%C3%A9marrage en cours...</p></body></html>`
  )

  startServer(appDir)

  waitForServer(() => {
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1100,
      minHeight: 700,
      title: 'Map Creator – Agence Moove',
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    win.loadURL(`http://127.0.0.1:${PORT}`)
    win.once('ready-to-show', () => {
      splash.destroy()
      win.show()
    })
    win.on('closed', () => app.quit())
  })
})

// If the user double-clicks while the app is already open, bring it to focus.
app.on('second-instance', () => {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    const win = wins[0]
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  serverProcess?.kill()
  app.quit()
})

app.on('before-quit', () => {
  serverProcess?.kill()
})
