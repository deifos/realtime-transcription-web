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

  // In development, load from local server
  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:3001");
  } else {
    // In production, load the built Next.js app
    win.loadFile(join(__dirname, "out/index.html"));
  }

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
