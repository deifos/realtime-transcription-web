import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

interface Settings {
  shortcuts: {
    startRecording: string;
  };
}

const DEFAULT_SETTINGS: Settings = {
  shortcuts: {
    startRecording: "Alt+Shift+S",
  },
};

class Store {
  private path: string;
  private data: Settings;

  constructor() {
    this.path = path.join(app.getPath("userData"), "settings.json");
    this.data = this.loadSettings();
  }

  private loadSettings(): Settings {
    try {
      if (fs.existsSync(this.path)) {
        const data = JSON.parse(fs.readFileSync(this.path, "utf8"));
        return { ...DEFAULT_SETTINGS, ...data };
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  get shortcuts() {
    return this.data.shortcuts;
  }

  setShortcut(key: keyof Settings["shortcuts"], value: string): void {
    this.data.shortcuts[key] = value;
    this.saveSettings();
  }
}

export const store = new Store();
