const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchExe: (exePath) => {
    // Use IPC to ask main process to launch exe
    ipcRenderer.invoke('launch-exe', exePath);
  }
});
