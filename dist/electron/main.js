"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const store_1 = require("./store");
let mainWindow = null;
let tray = null;
let isQuitting = false;
let currentShortcut = null;
let isShortcutPressed = false;
function registerRecordingShortcut(shortcut) {
    if (currentShortcut) {
        electron_1.globalShortcut.unregister(currentShortcut);
    }
    try {
        const success = electron_1.globalShortcut.register(shortcut, () => {
            if (mainWindow && !isShortcutPressed) {
                isShortcutPressed = true;
                mainWindow.webContents.send("shortcut-down");
                mainWindow.show();
                mainWindow.focus();
            }
        });
        if (success) {
            currentShortcut = shortcut;
            return true;
        }
        else {
            console.error(`Failed to register shortcut: ${shortcut}`);
            return false;
        }
    }
    catch (error) {
        console.error(`Error registering shortcut: ${shortcut}`, error);
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
                    mainWindow?.show();
                    mainWindow?.focus();
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
    mainWindow = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            enableWebSQL: false,
            preload: (0, path_1.join)(__dirname, "preload.js"),
        },
        // Add window customization for better desktop experience
        frame: true, // Changed to true for now to ensure window controls are visible
        transparent: false, // Changed to false for better visibility
        resizable: true, // Changed to true for better usability
        skipTaskbar: false, // Changed to false to show in taskbar while debugging
        show: false, // Don't show on startup
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
    // Show window when it's ready to prevent white flash
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
    // Hide instead of close when the close button is clicked
    mainWindow.on("close", (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
            return false;
        }
    });
    mainWindow.webContents.openDevTools();
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
    // Stop recording when keys are released
    if (mainWindow) {
        const window = mainWindow;
        // Monitor key states
        window.webContents.on("before-input-event", (event, input) => {
            // Check for any key release when shortcut is active
            if (isShortcutPressed &&
                input.type === "keyUp" &&
                (input.key === "Alt" ||
                    input.key === "Shift" ||
                    input.key.toLowerCase() === "s")) {
                isShortcutPressed = false;
                window.webContents.send("shortcut-up");
                // Window will be hidden after transcription completes
            }
        });
        // Also stop recording when window loses focus
        window.on("blur", () => {
            if (isShortcutPressed) {
                isShortcutPressed = false;
                window.webContents.send("shortcut-up");
                // Window will be hidden after transcription completes
            }
        });
        // Handle transcription complete event
        electron_1.ipcMain.on("transcription-complete", () => {
            setTimeout(() => {
                if (window && !isShortcutPressed) {
                    window.hide();
                }
            }, 3000); // Hide window 3 seconds after transcription output is shown
        });
    }
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
    }
    electron_1.globalShortcut.unregisterAll();
});
