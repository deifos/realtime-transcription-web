import { app, BrowserWindow } from "electron";
import { join } from "path";

function createWindow(): void {
  const win = new BrowserWindow({
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
  app.commandLine.appendSwitch("enable-unsafe-webgpu");
  app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");

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
app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");

app.whenReady().then(createWindow);

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
