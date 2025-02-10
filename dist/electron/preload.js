"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electron", {
    onShortcutDown: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on("shortcut-down", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("shortcut-down", handler);
        };
    },
    onShortcutUp: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on("shortcut-up", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("shortcut-up", handler);
        };
    },
});
