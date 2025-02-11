import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  ipcMain,
  clipboard,
} from "electron";
import { join } from "path";
import { store } from "./store";
import robotjs from "robotjs";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let currentShortcut: string | null = null;
let isShortcutPressed = false;

function registerRecordingShortcut(shortcut: string) {
  if (currentShortcut) {
    console.log("Unregistering previous shortcut:", currentShortcut);
    globalShortcut.unregister(currentShortcut);
    globalShortcut.unregister("Space");
  }

  try {
    console.log("Registering shortcut:", shortcut);
    // Register start shortcut
    const success = globalShortcut.register(shortcut, () => {
      console.log("Start shortcut triggered, current state:", {
        isShortcutPressed,
      });
      if (mainWindow && !isShortcutPressed) {
        // Start recording
        console.log("Starting recording via shortcut");
        isShortcutPressed = true;
        mainWindow.webContents.send("play-sound", "start");
        mainWindow.webContents.send("shortcut-down");
      }
    });

    // Register space for stopping
    const spaceSuccess = globalShortcut.register("Space", () => {
      console.log("Space pressed, current state:", { isShortcutPressed });
      if (mainWindow && isShortcutPressed) {
        // Stop recording
        console.log("Stopping recording via Space");
        isShortcutPressed = false;
        mainWindow.webContents.send("play-sound", "stop");
        mainWindow.webContents.send("stop-recording");
      }
    });

    if (success && spaceSuccess) {
      currentShortcut = shortcut;
      console.log("Successfully registered shortcuts");
      return true;
    } else {
      console.error(`Failed to register shortcuts`);
      return false;
    }
  } catch (error) {
    console.error(`Error registering shortcuts:`, error);
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
  console.log("Creating window with NODE_ENV:", process.env.NODE_ENV);

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      enableWebSQL: false,
      preload: join(__dirname, "preload.js"),
      devTools: true,
    },
    frame: true,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    show: false,
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

  // Handle clipboard write requests
  ipcMain.handle("clipboard-write", async (_, text: string) => {
    try {
      // Store the current clipboard content
      const previousClipboard = clipboard.readText();

      // Write the new text and simulate paste
      clipboard.writeText(text);
      console.log("Text copied to clipboard, simulating paste...");

      // Small delay to ensure clipboard is updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (process.platform === "darwin") {
        robotjs.keyTap("v", ["command"]);
      } else {
        robotjs.keyTap("v", ["control"]);
      }

      // Small delay before restoring clipboard
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Restore the previous clipboard content
      clipboard.writeText(previousClipboard);

      return true;
    } catch (error) {
      console.error("Failed to paste text:", error);
      return false;
    }
  });

  // Handle transcription complete event
  ipcMain.on("transcription-complete", () => {
    // No need to hide window since we're not showing it
  });

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
    globalShortcut.unregister("Space");
  }
  globalShortcut.unregisterAll();
});
