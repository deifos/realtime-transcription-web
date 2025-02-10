"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            enableWebSQL: false,
        },
    });
    // Enable WebGPU
    electron_1.app.commandLine.appendSwitch("enable-unsafe-webgpu");
    electron_1.app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");
    // Always use development server during electron-dev
    console.log("Loading development server...");
    win.loadURL("http://localhost:3001").catch((err) => {
        console.error("Failed to load URL:", err);
        // Retry loading after a short delay
        setTimeout(() => {
            console.log("Retrying to load development server...");
            win.loadURL("http://localhost:3001");
        }, 1000);
    });
    win.webContents.openDevTools();
}
// This needs to be called before app is ready
electron_1.app.commandLine.appendSwitch("enable-unsafe-webgpu");
electron_1.app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");
electron_1.app.whenReady().then(createWindow);
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
