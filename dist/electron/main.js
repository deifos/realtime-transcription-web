"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const store_1 = require("./store");
const robotjs_1 = __importDefault(require("robotjs"));
let mainWindow = null;
let tray = null;
let isQuitting = false;
let currentShortcut = null;
let isShortcutPressed = false;
function registerRecordingShortcut(shortcut) {
    if (currentShortcut) {
        console.log("Unregistering previous shortcut:", currentShortcut);
        electron_1.globalShortcut.unregister(currentShortcut);
    }
    try {
        console.log("Registering shortcut:", shortcut);
        // Register start shortcut
        const success = electron_1.globalShortcut.register(shortcut, () => {
            console.log("Start shortcut triggered, current state:", {
                isShortcutPressed,
            });
            if (mainWindow && !isShortcutPressed) {
                // Start recording
                console.log("Starting recording via shortcut");
                isShortcutPressed = true;
                mainWindow.webContents.send("play-sound", "start");
                mainWindow.webContents.send("shortcut-down");
                // Register space for stopping only while recording
                electron_1.globalShortcut.register("Space", () => {
                    console.log("Space pressed, stopping recording");
                    if (mainWindow && isShortcutPressed) {
                        isShortcutPressed = false;
                        mainWindow.webContents.send("play-sound", "stop");
                        mainWindow.webContents.send("stop-recording");
                        // Unregister space after stopping
                        electron_1.globalShortcut.unregister("Space");
                    }
                });
            }
        });
        if (success) {
            currentShortcut = shortcut;
            console.log("Successfully registered shortcuts");
            return true;
        }
        else {
            console.error(`Failed to register shortcuts`);
            return false;
        }
    }
    catch (error) {
        console.error(`Error registering shortcuts:`, error);
        return false;
    }
}
function createTray() {
    // Create a default 16x16 icon as a fallback
    const icon = electron_1.nativeImage.createEmpty();
    const size = 16;
    const imageData = Buffer.alloc(size * size * 4);
    // Fill with a solid color (e.g., white)
    for (let i = 0; i < imageData.length; i += 4) {
        imageData[i] = 255; // R
        imageData[i + 1] = 255; // G
        imageData[i + 2] = 255; // B
        imageData[i + 3] = 255; // A
    }
    icon.addRepresentation({
        width: size,
        height: size,
        buffer: imageData,
        scaleFactor: 1.0,
    });
    tray = new electron_1.Tray(icon);
    tray.setToolTip("Speech to Text");
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "Show/Hide Window",
            click: () => {
                if (mainWindow?.isVisible()) {
                    mainWindow.hide();
                }
                else {
                    mainWindow?.showInactive();
                }
            },
        },
        { type: "separator" },
        {
            label: "Settings",
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.webContents.send("open-settings");
                }
            },
        },
        { type: "separator" },
        {
            label: "Quit",
            click: () => {
                isQuitting = true;
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    // Double click shows/hides the window
    tray.on("double-click", () => {
        if (mainWindow?.isVisible()) {
            mainWindow.hide();
        }
        else {
            mainWindow?.show();
            mainWindow?.focus();
        }
    });
}
function createWindow() {
    console.log("Creating window with NODE_ENV:", process.env.NODE_ENV);
    mainWindow = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            enableWebSQL: false,
            preload: (0, path_1.join)(__dirname, "preload.js"),
            devTools: true,
        },
        frame: true,
        transparent: false,
        resizable: true,
        skipTaskbar: false,
        show: false,
    });
    // Enable WebGPU
    electron_1.app.commandLine.appendSwitch("enable-unsafe-webgpu");
    electron_1.app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");
    // Always use development server during electron-dev
    console.log("Loading development server...");
    mainWindow.loadURL("http://localhost:3001").catch((err) => {
        console.error("Failed to load URL:", err);
        // Retry loading after a short delay
        setTimeout(() => {
            console.log("Retrying to load development server...");
            mainWindow?.loadURL("http://localhost:3001");
        }, 1000);
    });
    // Show window when ready
    mainWindow.once("ready-to-show", () => {
        console.log("Window ready to show");
        mainWindow?.show();
        mainWindow?.webContents.openDevTools();
        console.log("DevTools opened");
    });
    // Register global keyboard events
    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.control && input.key.toLowerCase() === "i") {
            console.log("DevTools shortcut pressed");
            mainWindow?.webContents.toggleDevTools();
        }
    });
    // Hide instead of close when the close button is clicked
    mainWindow.on("close", (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
            return false;
        }
    });
}
// This needs to be called before app is ready
electron_1.app.commandLine.appendSwitch("enable-unsafe-webgpu");
electron_1.app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");
// Prevent multiple instances of the app
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", () => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    createTray();
    // Register the shortcut from settings
    const shortcut = store_1.store.shortcuts.startRecording;
    registerRecordingShortcut(shortcut);
    // Handle clipboard write requests
    electron_1.ipcMain.handle("clipboard-write", async (_, text) => {
        try {
            console.log("Handling clipboard write request:", { text });
            // Store the current clipboard content
            const previousClipboard = electron_1.clipboard.readText();
            console.log("Previous clipboard content stored");
            // Write the new text and simulate paste
            electron_1.clipboard.writeText(text);
            console.log("Text copied to clipboard, simulating paste...");
            // Small delay to ensure clipboard is updated
            await new Promise((resolve) => setTimeout(resolve, 200));
            if (process.platform === "darwin") {
                robotjs_1.default.keyTap("v", ["command"]);
            }
            else {
                robotjs_1.default.keyTap("v", ["control"]);
            }
            console.log("Paste simulated");
            // Small delay before restoring clipboard
            await new Promise((resolve) => setTimeout(resolve, 200));
            // Restore the previous clipboard content
            electron_1.clipboard.writeText(previousClipboard);
            console.log("Previous clipboard content restored");
            return true;
        }
        catch (error) {
            console.error("Failed to paste text:", error);
            return false;
        }
    });
    // Handle transcription complete event
    electron_1.ipcMain.on("transcription-complete", () => {
        console.log("Transcription complete event received");
    });
    // Handle shortcut change requests from renderer
    electron_1.ipcMain.handle("update-shortcut", async (_, shortcut) => {
        const success = registerRecordingShortcut(shortcut);
        if (success) {
            store_1.store.setShortcut("startRecording", shortcut);
            return true;
        }
        return false;
    });
    // Handle requests to get current shortcut
    electron_1.ipcMain.handle("get-shortcut", () => {
        return store_1.store.shortcuts.startRecording;
    });
});
// Quit when all windows are closed, except on macOS
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
// Clean up before quit
electron_1.app.on("before-quit", () => {
    isQuitting = true;
});
// Clean up shortcuts when app is quitting
electron_1.app.on("will-quit", () => {
    if (currentShortcut) {
        electron_1.globalShortcut.unregister(currentShortcut);
        electron_1.globalShortcut.unregister("Space");
    }
    electron_1.globalShortcut.unregisterAll();
});
