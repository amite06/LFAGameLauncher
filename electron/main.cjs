const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#181a20',
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC handler for launching exe
ipcMain.handle('launch-exe', async (event, exePath) => {
  try {
    const child = execFile(exePath, (error) => {
      if (error) {
        // Optionally, send error back to renderer
        console.error('Failed to launch:', exePath, error);
      }
    });

    if (!child || !child.pid) {
      console.error('Could not start process for', exePath);
      // Even if the direct child didn't start or exited quickly, continue to monitor by executable name
    }

  const exeName = path.basename(exePath).toLowerCase();
  const exeBase = path.basename(exePath, path.extname(exePath));

    // Track this running game and monitor system idle time.
    // If the system is idle for >= 60 seconds, kill the child process.
    const pid = child.pid;
  const IDLE_LIMIT_SEC = 120;
    const CHECK_MS = 1000;

  console.log(`Launched ${exePath} (pid=${pid}). Starting idle monitor (watching ${exeName}).`);
  let attemptingKill = false;
  let childExited = false;

    // We'll manage activity timers per-launch using this monitor object
    const monitors = global.__gameMonitors ||= new Map();

    // Create monitor state for this launched exe
    const monitor = {
      exePath,
      exeName,
      pid,
      timer: null,
      lastActivity: Date.now(),
      cleared: false,
    };
    monitors.set(pid, monitor);

    // Helper to clear monitor
    function clearMonitor() {
      if (monitor.cleared) return;
      monitor.cleared = true;
      if (monitor.timer) clearTimeout(monitor.timer);
      monitors.delete(pid);
      console.log(`Cleared monitor for pid=${pid}`);
    }

    function scheduleTimeout() {
      if (monitor.timer) clearTimeout(monitor.timer);
      monitor.timer = setTimeout(async () => {
        try {
          const idleTime = powerMonitor.getSystemIdleTime();
          if (idleTime < IDLE_LIMIT_SEC) {
            // User was not idle, reschedule check
            scheduleTimeout();
            return;
          }

          console.log(`User has been idle for ${idleTime}s (>= ${IDLE_LIMIT_SEC}s) for pid=${pid}. Attempting to close ${exeName}`);
          // Notify renderer(s) attempting
          try {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach((w) => w.webContents.send('game-killed-for-idle', { exePath, pid, idleSec: IDLE_LIMIT_SEC, status: 'attempting' }));
          } catch (err) {
            console.error('Failed to notify renderers about idle kill (attempting)', err);
          }

          // Perform graceful kill by name (PowerShell / taskkill / pkill)
          const { execFile: _execFile } = require('child_process');
          if (process.platform === 'win32') {
            try {
              const psCmd = `Get-Process -Name \"${exeBase}\" -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() }`;
              _execFile('powershell', ['-NoProfile', '-Command', psCmd], (error, stdout, stderr) => {
                if (error) console.error('PowerShell CloseMainWindow failed for', exeBase, error, stderr);
                else console.log('PowerShell CloseMainWindow output:', stdout);
              });
            } catch (err) {
              console.error('Error invoking PowerShell CloseMainWindow', err);
            }
            _execFile('taskkill', ['/IM', exeName, '/T'], (error, stdout, stderr) => {
              if (error) console.error('taskkill (graceful by name) failed for', exeName, error, stderr);
              else console.log('taskkill (graceful) output:', stdout);
            });
            // wait 2s then force
            setTimeout(() => {
              _execFile('taskkill', ['/IM', exeName, '/T', '/F'], (error, stdout, stderr) => {
                if (error) console.error('taskkill (force) failed for image=' + exeName, error, stderr);
                else console.log('taskkill (force) output:', stdout);
                // notify final
                try {
                  const windows2 = BrowserWindow.getAllWindows();
                  windows2.forEach((w) => w.webContents.send('game-killed-for-idle', { exePath, pid, idleSec: IDLE_LIMIT_SEC, status: 'killed' }));
                } catch (err) {
                  console.error('Failed to notify renderers about idle kill (final)', err);
                }
                clearMonitor();
              });
            }, 2000);
          } else {
            _execFile('pkill', ['-f', exeName], (error, stdout, stderr) => {
              if (error) console.error('pkill (graceful) failed for', exeName, error, stderr);
              else console.log('pkill (graceful) output:', stdout);
            });
            setTimeout(() => {
              _execFile('pkill', ['-9', '-f', exeName], (error, stdout, stderr) => {
                if (error) console.error('pkill (force) failed for', exeName, error, stderr);
                else console.log('pkill (force) output:', stdout);
                try {
                  const windows2 = BrowserWindow.getAllWindows();
                  windows2.forEach((w) => w.webContents.send('game-killed-for-idle', { exePath, pid, idleSec: IDLE_LIMIT_SEC, status: 'killed' }));
                } catch (err) {
                  console.error('Failed to notify renderers about idle kill (final)', err);
                }
                clearMonitor();
              });
            }, 2000);
          }
        } catch (err) {
          console.error('Error during scheduled timeout action for', pid, err);
        }
      }, IDLE_LIMIT_SEC * 1000);
    }

  // expose schedule function on monitor so IPC handler can reset it
  monitor.scheduleTimeout = scheduleTimeout;

    // start the first timeout
    scheduleTimeout();

    // Listen for user activity IPC to reset timer
    // handler will be added below outside this scope

    // Keep a reference for eventual cleanup when the child exits
    child.on('exit', (code, signal) => {
      console.log(`Game process pid=${pid} exited (code=${code}, signal=${signal}). Clearing monitor.`);
      clearMonitor();
    });

    // Add a fallback: also watch for process disappearance by name every 5s
    const watcher = setInterval(async () => {
      try {
        const existsNow = await (async () => {
          return new Promise((resolve) => {
            const { execFile: _execFile } = require('child_process');
            if (process.platform === 'win32') {
              _execFile('tasklist', ['/FI', `IMAGENAME eq ${exeName}`], (error, stdout, stderr) => {
                if (error) return resolve(false);
                const exists = stdout && stdout.toLowerCase().includes(exeName);
                resolve(Boolean(exists));
              });
            } else {
              _execFile('pgrep', ['-f', exeName], (error, stdout, stderr) => {
                if (error) return resolve(false);
                resolve(Boolean(stdout && stdout.trim()));
              });
            }
          });
        })();
        if (!existsNow) {
          clearInterval(watcher);
          clearMonitor();
        }
      } catch (err) {
        // ignore
      }
    }, 5000);
    
  // expose monitor in global for activity handler
  global.__lastLaunchedPid = pid;
  global.__gameMonitors.set(pid, monitor);
  } catch (err) {
    console.error('Failed to launch exe (exception):', exePath, err);
  }
});

// IPC endpoint from renderer to notify user activity (mouse/keys/gamepad)
ipcMain.handle('user-activity', async () => {
  // This is now handled by the powerMonitor, but we'll keep the handler
  // so the renderer doesn't error. It will effectively do nothing.
});

app.whenReady().then(() => {
  createWindow();

  // Reset monitors on system-level user activity (works even when the app loses focus)
  try {
    powerMonitor.on('user-active', () => {
      try {
        const monitors = global.__gameMonitors || new Map();
        monitors.forEach((mon) => {
          try {
            if (mon && typeof mon.scheduleTimeout === 'function') {
              mon.scheduleTimeout();
            }
          } catch (err) {
            console.error('Error resetting monitor on user-active', err);
          }
        });
      } catch (err) {
        console.error('Error handling powerMonitor user-active', err);
      }
    });
  } catch (err) {
    // powerMonitor may not be available in some environments
    console.warn('powerMonitor user-active not available', err);
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
