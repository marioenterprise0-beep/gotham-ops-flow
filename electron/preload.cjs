"use strict";
// Preload runs in an isolated context with access to both Node.js and the renderer.
// Only expose exactly what the renderer needs — nothing more.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // App info
  getVersion: () => ipcRenderer.invoke("get-version"),
  getPlatform: () => process.platform,

  // Notifications (native Mac notifications triggered from JS)
  showNotification: (title, body, url) =>
    ipcRenderer.invoke("show-notification", { title, body, url }),

  // Navigation (tell main process to load a URL)
  navigate: (path) => ipcRenderer.invoke("navigate", path),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke("check-updates"),
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", cb),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  // Remove listeners on cleanup
  removeListener: (channel, cb) => ipcRenderer.removeListener(channel, cb),
});
