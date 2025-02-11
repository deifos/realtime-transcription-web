"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electron", {
    onShortcutDown: (callback) => {
        const handler = () => {
            console.log("Preload: Received shortcut-down event");
            callback();
        };
        electron_1.ipcRenderer.on("shortcut-down", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("shortcut-down", handler);
        };
    },
    onShortcutUp: (callback) => {
        const handler = () => {
            console.log("Preload: Received shortcut-up event");
            callback();
        };
        electron_1.ipcRenderer.on("shortcut-up", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("shortcut-up", handler);
        };
    },
    onStopRecording: (callback) => {
        const handler = () => {
            console.log("Preload: Received stop-recording event");
            callback();
        };
        electron_1.ipcRenderer.on("stop-recording", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("stop-recording", handler);
        };
    },
    onOpenSettings: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on("open-settings", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("open-settings", handler);
        };
    },
    onPlaySound: (callback) => {
        const handler = (_, sound) => callback(sound);
        electron_1.ipcRenderer.on("play-sound", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("play-sound", handler);
        };
    },
    onForceCleanup: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on("force-cleanup", handler);
        return () => {
            electron_1.ipcRenderer.removeListener("force-cleanup", handler);
        };
    },
    shortcuts: {
        update: (shortcut) => electron_1.ipcRenderer.invoke("update-shortcut", shortcut),
        getCurrent: () => electron_1.ipcRenderer.invoke("get-shortcut"),
    },
    notifyTranscriptionComplete: () => electron_1.ipcRenderer.send("transcription-complete"),
    clipboard: {
        writeText: (text) => electron_1.ipcRenderer.invoke("clipboard-write", text),
    },
});
