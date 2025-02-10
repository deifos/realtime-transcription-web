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
    onOpenSettings: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on("open-settings", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("open-settings", handler);
        };
    },
    shortcuts: {
        update: (shortcut) => electron_1.ipcRenderer.invoke("update-shortcut", shortcut),
        getCurrent: () => electron_1.ipcRenderer.invoke("get-shortcut"),
    },
    notifyTranscriptionComplete: () => electron_1.ipcRenderer.send("transcription-complete"),
});
