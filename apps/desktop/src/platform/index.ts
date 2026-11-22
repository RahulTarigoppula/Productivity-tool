import type { Platform } from "./types";
import { createBrowserPlatform } from "./browser";
import { createTauriPlatform } from "./tauri";

export * from "./types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const platform: Platform = isTauri ? createTauriPlatform() : createBrowserPlatform();
