/** Tab hibernation: Office editors (and to a lesser degree PDFs) hold a lot of memory. A tab
 *  that is in the background, has no unsaved changes and matches its file on disk can let its
 *  editor go; it is reloaded from the file when the tab is shown again.
 *  A tab sleeps after 10 minutes in the background, or as soon as more than three heavy tabs
 *  are awake (the least recently used sleeps first). */
import type { Tab } from "./store";

const HEAVY = new Set(["docx", "xlsx", "pptx", "pdf"]);
export const MAX_AWAKE_HEAVY = 3;

const lastActive = new Map<string, number>();
const awake = new Set<string>();

function idleMs(): number {
  const t = (globalThis as { __hibernateAfterMs?: number }).__hibernateAfterMs;
  return typeof t === "number" ? t : 10 * 60 * 1000;
}

export function touch(id: string, at = Date.now()): void {
  lastActive.set(id, at);
}

export function setAwake(id: string, on: boolean): void {
  if (on) awake.add(id);
  else awake.delete(id);
}

export function forget(id: string): void {
  lastActive.delete(id);
  awake.delete(id);
}

/** Whether a tab may sleep at all (never loses anything). */
export function canSleep(tab: Tab, active: boolean): boolean {
  return (
    !active &&
    HEAVY.has(tab.kind) &&
    !!tab.path &&
    !tab.dirty &&
    !tab.conflict &&
    !tab.loading &&
    !tab.error &&
    !tab.baselineUnsaved &&
    tab.saveState !== "new" &&
    tab.saveState !== "saving"
  );
}

/** Whether a tab should sleep now. */
export function shouldSleep(tab: Tab, active: boolean, now = Date.now()): boolean {
  if (!canSleep(tab, active)) return false;
  const last = lastActive.get(tab.id) ?? 0;
  if (now - last >= idleMs()) return true;
  // Too many heavy editors awake: the least recently used ones sleep.
  const heavy = [...awake].sort((a, b) => (lastActive.get(b) ?? 0) - (lastActive.get(a) ?? 0));
  return heavy.indexOf(tab.id) >= MAX_AWAKE_HEAVY;
}
