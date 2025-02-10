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
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("open-settings", handler);
    return () => {
      ipcRenderer.removeListener("open-settings", handler);
    };
  },
  shortcuts: {
    update: (shortcut: string) =>
      ipcRenderer.invoke("update-shortcut", shortcut),
    getCurrent: () => ipcRenderer.invoke("get-shortcut"),
  },
});
