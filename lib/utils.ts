/// <reference types="@webgpu/types" />

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FormatDateOptions {
  hour12: boolean;
  year: "numeric";
  month: "numeric";
  day: "numeric";
  hour: "numeric";
  minute: "numeric";
  second: "numeric";
  fractionalSecondDigits: 3 | 1 | 2 | undefined;
}

export function formatDate(timestamp: number): string {
  const options: FormatDateOptions = {
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    fractionalSecondDigits: 3,
  };
  return new Date(timestamp).toLocaleString("zh", options);
}

interface NavigatorGPU {
  gpu?: GPU;
}

export async function supportsWebGPU() {
  try {
    const nav = navigator as NavigatorGPU;
    if (!nav.gpu) return false;
    await nav.gpu.requestAdapter();
    return true;
  } catch (error) {
    console.error("WebGPU not supported:", error);
    return false;
  }
}
