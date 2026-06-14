"use strict";
const { app, Menu, shell, BrowserWindow } = require("electron");

const APP_URL = "https://gothamhalaldash.com";

function navigate(path) {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.loadURL(`${APP_URL}${path}`);
}

function buildMenu(autoUpdater) {
  const isMac = process.platform === "darwin";

  const template = [
    // ── App menu (macOS only) ────────────────────────────────────────────────
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Check for Updates…",
                click: () => autoUpdater.checkForUpdates(),
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),

    // ── Operations ───────────────────────────────────────────────────────────
    {
      label: "Operations",
      submenu: [
        { label: "Dashboard", accelerator: "CmdOrCtrl+1", click: () => navigate("/") },
        { label: "Time Clock", accelerator: "CmdOrCtrl+2", click: () => navigate("/time-clock") },
        { label: "Daily Recap", accelerator: "CmdOrCtrl+3", click: () => navigate("/recaps") },
        { label: "Prep Log", click: () => navigate("/prep-log") },
        { label: "Operations", click: () => navigate("/operations") },
        { type: "separator" },
        { label: "Inventory", accelerator: "CmdOrCtrl+I", click: () => navigate("/inventory") },
        { label: "Schedule", click: () => navigate("/schedule") },
        { label: "Alerts", accelerator: "CmdOrCtrl+A", click: () => navigate("/alerts") },
        { label: "My Tasks", accelerator: "CmdOrCtrl+T", click: () => navigate("/my-tasks") },
      ],
    },

    // ── Management ───────────────────────────────────────────────────────────
    {
      label: "Management",
      submenu: [
        { label: "Command Center", accelerator: "CmdOrCtrl+M", click: () => navigate("/manager") },
        { label: "Analytics", click: () => navigate("/analytics") },
        { label: "Labor", click: () => navigate("/labor") },
        { label: "Cash", click: () => navigate("/cash") },
        { label: "SOPs", click: () => navigate("/sops") },
        { type: "separator" },
        { label: "Recaps", click: () => navigate("/recaps") },
        { label: "Archive Center", click: () => navigate("/archive-center") },
        { type: "separator" },
        { label: "Admin", click: () => navigate("/admin") },
        { label: "Users", click: () => navigate("/users") },
        { label: "Permissions", click: () => navigate("/permissions") },
        { label: "Settings", accelerator: "CmdOrCtrl+,", click: () => navigate("/settings") },
      ],
    },

    // ── View ─────────────────────────────────────────────────────────────────
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },

    // ── Window ───────────────────────────────────────────────────────────────
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" }, { role: "front" }, { type: "separator" }, { role: "window" }]
          : [{ role: "close" }]),
      ],
    },

    // ── Help ─────────────────────────────────────────────────────────────────
    {
      role: "help",
      submenu: [
        {
          label: "Open in Browser",
          click: () => shell.openExternal(APP_URL),
        },
        { type: "separator" },
        {
          label: "SOPs & Training Guides",
          click: () => navigate("/sops"),
        },
        {
          label: "Report an Issue",
          click: () => shell.openExternal("https://github.com/marioenterprise0-beep/gothamhalaldash/issues"),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
