"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_SETTINGS = {
    shortcuts: {
        startRecording: "Alt+Shift+S",
    },
};
class Store {
    constructor() {
        this.path = path.join(electron_1.app.getPath("userData"), "settings.json");
        this.data = this.loadSettings();
    }
    loadSettings() {
        try {
            if (fs.existsSync(this.path)) {
                const data = JSON.parse(fs.readFileSync(this.path, "utf8"));
                return { ...DEFAULT_SETTINGS, ...data };
            }
        }
        catch (error) {
            console.error("Failed to load settings:", error);
        }
        return { ...DEFAULT_SETTINGS };
    }
    saveSettings() {
        try {
            fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
        }
        catch (error) {
            console.error("Failed to save settings:", error);
        }
    }
    get shortcuts() {
        return this.data.shortcuts;
    }
    setShortcut(key, value) {
        this.data.shortcuts[key] = value;
        this.saveSettings();
    }
}
exports.store = new Store();
