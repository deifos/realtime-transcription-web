import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  ipcMain,
} from "electron";
import { join } from "path";
import { store } from "./store";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let currentShortcut: string | null = null;
let isShortcutPressed = false;

function registerRecordingShortcut(shortcut: string) {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
  }

  try {
    const success = globalShortcut.register(shortcut, () => {
      if (mainWindow && !isShortcutPressed) {
        isShortcutPressed = true;
        mainWindow.webContents.send("shortcut-down");
      }
    });

    if (success) {
      currentShortcut = shortcut;
      return true;
    } else {
      console.error(`Failed to register shortcut: ${shortcut}`);
      return false;
    }
  } catch (error) {
    console.error(`Error registering shortcut: ${shortcut}`, error);
    return false;
  }
}

function createTray(): void {
  // Create a default 16x16 icon as a fallback
  const icon = nativeImage.createEmpty();
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

  tray = new Tray(icon);
  tray.setToolTip("Speech to Text");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show/Hide Window",
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
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
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double click shows/hides the window
  tray.on("double-click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      enableWebSQL: false,
      preload: join(__dirname, "preload.js"),
    },
    // Add window customization for better desktop experience
    frame: true, // Changed to true for now to ensure window controls are visible
    transparent: false, // Changed to false for better visibility
    resizable: true, // Changed to true for better usability
    skipTaskbar: false, // Changed to false to show in taskbar while debugging
    show: false, // Don't show on startup
  });

  // Enable WebGPU
  app.commandLine.appendSwitch("enable-unsafe-webgpu");
  app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");

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
app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register the shortcut from settings
  const shortcut = store.shortcuts.startRecording;
  registerRecordingShortcut(shortcut);

  // Stop recording when keys are released
  if (mainWindow) {
    const window = mainWindow;

    // Monitor key states
    window.webContents.on("before-input-event", (event, input) => {
      // Check for any key release when shortcut is active
      if (
        isShortcutPressed &&
        input.type === "keyUp" &&
        (input.key === "Alt" ||
          input.key === "Shift" ||
          input.key.toLowerCase() === "s")
      ) {
        isShortcutPressed = false;
        window.webContents.send("shortcut-up");
      }
    });

    // Also stop recording when window loses focus
    window.on("blur", () => {
      if (isShortcutPressed) {
        isShortcutPressed = false;
        window.webContents.send("shortcut-up");
      }
    });
  }

  // Handle shortcut change requests from renderer
  ipcMain.handle("update-shortcut", async (_, shortcut: string) => {
    const success = registerRecordingShortcut(shortcut);
    if (success) {
      store.setShortcut("startRecording", shortcut);
      return true;
    }
    return false;
  });

  // Handle requests to get current shortcut
  ipcMain.handle("get-shortcut", () => {
    return store.shortcuts.startRecording;
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up before quit
app.on("before-quit", () => {
  isQuitting = true;
});

// Clean up shortcuts when app is quitting
app.on("will-quit", () => {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
  }
  globalShortcut.unregisterAll();
});
