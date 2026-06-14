"use strict";
const { app, BrowserWindow, Menu, ipcMain, Notification, shell, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const AutoLaunch = require("electron-auto-launch");
const log = require("electron-log");
const path = require("path");
const { buildMenu } = require("./menu.cjs");

// ─── Logging ──────────────────────────────────────────────────────────────────
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const APP_URL = "https://gothamhalaldash.com";
const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;

// ─── Auto-launch on Mac startup ───────────────────────────────────────────────
const autoLauncher = new AutoLaunch({
  name: "Gothamhalal Dash",
  isHidden: false,
});

// ─── Create main window ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Gothamhalal Dash",
    icon: path.join(__dirname, "build", "icon.icns"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Allow web notifications from the app
      partition: "persist:gothamhalal",
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0A0A0A",
    show: false,
    vibrancy: undefined,
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open external links in the default browser, not in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Handle navigations that leave gothamhalaldash.com
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith("https://") && !url.startsWith("http://")) {
      event.preventDefault();
    }
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Allow notifications from the web content
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["notifications", "geolocation", "media", "camera"];
    callback(allowedPermissions.includes(permission));
  });

  createWindow();

  // Build and apply the Mac menu bar
  const menu = buildMenu(autoUpdater);
  Menu.setApplicationMenu(menu);

  // Enable auto-launch at login
  try {
    const enabled = await autoLauncher.isEnabled();
    if (!enabled) await autoLauncher.enable();
  } catch (err) {
    log.warn("Auto-launch setup failed:", err.message);
  }

  // Check for Electron shell updates (not the web content — that's live already)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
    // Re-check every hour
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 60 * 60 * 1000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle("get-version", () => app.getVersion());

ipcMain.handle("navigate", (_, path) => {
  if (mainWindow) mainWindow.webContents.loadURL(`${APP_URL}${path}`);
});

ipcMain.handle("show-notification", (_, { title, body, url }) => {
  if (!Notification.isSupported()) return;
  const notif = new Notification({
    title,
    body,
    icon: path.join(__dirname, "build", "icon.png"),
    silent: false,
  });
  notif.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      if (url) mainWindow.webContents.loadURL(`${APP_URL}${url}`);
    }
  });
  notif.show();
});

ipcMain.handle("check-updates", () => {
  if (!isDev) autoUpdater.checkForUpdates();
});

ipcMain.handle("install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});

// ─── Auto-updater events ──────────────────────────────────────────────────────
autoUpdater.on("update-available", (info) => {
  log.info("Update available:", info.version);
  if (mainWindow) mainWindow.webContents.send("update-available", info);

  if (Notification.isSupported()) {
    new Notification({
      title: "Update Available",
      body: `Version ${info.version} is downloading in the background.`,
    }).show();
  }
});

autoUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded:", info.version);
  if (mainWindow) mainWindow.webContents.send("update-downloaded", info);

  if (Notification.isSupported()) {
    new Notification({
      title: "Update Ready to Install",
      body: `Gothamhalal Dash ${info.version} will install when you quit the app.`,
    }).show();
  }
});

autoUpdater.on("error", (err) => {
  log.error("Auto-updater error:", err.message);
});
