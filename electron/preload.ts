import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  onShortcutDown: (callback: () => void) => {
    const handler = () => {
      console.log("Preload: Received shortcut-down event");
      callback();
    };
    ipcRenderer.on("shortcut-down", handler);
    return () => {
      ipcRenderer.removeListener("shortcut-down", handler);
    };
  },
  onShortcutUp: (callback: () => void) => {
    const handler = () => {
      console.log("Preload: Received shortcut-up event");
      callback();
    };
    ipcRenderer.on("shortcut-up", handler);
    return () => {
      ipcRenderer.removeListener("shortcut-up", handler);
    };
  },
  onStopRecording: (callback: () => void) => {
    const handler = () => {
      console.log("Preload: Received stop-recording event");
      callback();
    };
    ipcRenderer.on("stop-recording", handler);
    return () => {
      ipcRenderer.removeListener("stop-recording", handler);
    };
  },
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("open-settings", handler);
    return () => {
      ipcRenderer.removeListener("open-settings", handler);
    };
  },
  onPlaySound: (callback: (sound: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, sound: string) =>
      callback(sound);
    ipcRenderer.on("play-sound", handler);
    return () => {
      ipcRenderer.removeListener("play-sound", handler);
    };
  },
  onForceCleanup: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("force-cleanup", handler);
    return () => {
      ipcRenderer.removeListener("force-cleanup", handler);
    };
  },
  shortcuts: {
    update: (shortcut: string) =>
      ipcRenderer.invoke("update-shortcut", shortcut),
    getCurrent: () => ipcRenderer.invoke("get-shortcut"),
  },
  notifyTranscriptionComplete: () => ipcRenderer.send("transcription-complete"),
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke("clipboard-write", text),
  },
});
