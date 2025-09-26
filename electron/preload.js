const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchExe: (exePath) => {
    // Use IPC to ask main process to launch exe
    ipcRenderer.invoke('launch-exe', exePath);
  }
  ,
  onGameKilled: (callback) => {
    // Listen for notifications from main when it kills a game due to idle
    ipcRenderer.on('game-killed-for-idle', (event, info) => {
      try {
        callback(info);
      } catch (err) {
        console.error('Error in onGameKilled callback', err);
      }
    });
  }
  ,
  onIdleUpdate: (callback) => {
    ipcRenderer.on('idle-update', (event, info) => {
      try {
        callback(info);
      } catch (err) {
        console.error('Error in onIdleUpdate callback', err);
      }
    });
  }
  ,
  notifyActivity: () => {
    // renderer calls this when it detects user input to reset idle timers in main
    try {
      ipcRenderer.invoke('user-activity');
    } catch (err) {
      console.error('Failed to invoke user-activity', err);
    }
  }
});
