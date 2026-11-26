/** Whether the last thing the person did was press a key rather than point or touch, so that a tool
 *  started from the keyboard can be finished from the keyboard too (no click on the page needed). */
let keyboard = false;
let listening = false;

export function lastInputWasKeyboard(): boolean {
  if (!listening) {
    listening = true;
    // Lone modifiers do not count: Ctrl held for Ctrl+click is still a click.
    window.addEventListener("keydown", (e) => { if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) keyboard = true; }, true);
    window.addEventListener("pointerdown", () => (keyboard = false), true);
  }
  return keyboard;
}

// Start listening as soon as the PDF engine loads, before the first question is asked.
if (typeof window !== "undefined") lastInputWasKeyboard();
