import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  onShortcutDown: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("shortcut-down", handler);
    return () => {
      ipcRenderer.removeListener("shortcut-down", handler);
    };
  },
  onShortcutUp: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("shortcut-up", handler);
    return () => {
      ipcRenderer.removeListener("shortcut-up", handler);
    };
  },
});
