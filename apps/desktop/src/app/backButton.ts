/** Android back button/gesture: step back through what is open, the way Android apps do —
 *  close a question, the palette, a dialog, focus mode or the sidebar; otherwise a second press
 *  within two seconds closes the app. */
import { getState, setState, toast } from "./store";
import { toggleFocusMode } from "./commands";

let armedAt = 0;

export async function installBackButton(): Promise<void> {
  if (!/Android/i.test(navigator.userAgent)) return;
  const { onBackButtonPress, exit } = await import("@tauri-apps/api/app");
  await onBackButtonPress(() => {
    const s = getState();
    if (document.querySelector("[role=alertdialog]")) {
      // A question is waiting (for example "save changes?"): back means cancel, like Escape.
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
    if (s.palette.open) return setState({ palette: { open: false, query: "" } });
    if (s.dialog) return setState({ dialog: null });
    if (s.focusMode) return toggleFocusMode();
    if (s.leftOpen) return setState({ leftOpen: false });
    if (Date.now() - armedAt < 2000) {
      // Unsaved work is already kept by crash recovery and restored on the next start.
      void exit(0);
      return;
    }
    armedAt = Date.now();
    toast("Press back again to close");
  });
}
