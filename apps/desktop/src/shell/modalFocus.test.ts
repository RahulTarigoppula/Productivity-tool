// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { pushLayer, popLayer } from "./modalFocus";

function window_() {
  document.body.innerHTML = `
    <div id="root"><div class="app">
      <div class="tabrow"><button>Menu</button></div>
      <div class="main"><button>In the document</button></div>
      <div class="overlay settings"><div role="dialog"><button>Done</button></div></div>
      <div class="overlay question"><div role="alertdialog"><button>Cancel</button></div></div>
      <div class="toasts" data-stays-live=""><button>Dismiss</button></div>
    </div></div>`;
  const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
  // jsdom has no inert of its own: an element is inert once it was set to true.
  for (const el of document.querySelectorAll<HTMLElement>("#root *")) el.inert = false;
  return { tabrow: $(".tabrow"), main: $(".main"), settings: $(".settings"), question: $(".question"), toasts: $(".toasts") };
}

describe("modal layers", () => {
  it("make everything behind the top dialog inert, and undo it as dialogs close", () => {
    const w = window_();
    const settings = pushLayer(w.settings);
    expect([w.tabrow.inert, w.main.inert, w.settings.inert]).toEqual([true, true, false]);
    // A question over Settings: Settings itself is behind it now.
    const question = pushLayer(w.question);
    expect([w.settings.inert, w.question.inert, w.main.inert]).toEqual([true, false, true]);
    popLayer(question);
    expect([w.settings.inert, w.tabrow.inert]).toEqual([false, true]);
    popLayer(settings);
    expect([w.tabrow.inert, w.main.inert, w.settings.inert, w.question.inert]).toEqual([false, false, false, false]);
  });

  it("leave notifications live, so they are still read out", () => {
    const w = window_();
    const layer = pushLayer(w.settings);
    expect(w.toasts.inert).toBe(false);
    popLayer(layer);
  });

  it("do not undo inert that something else set", () => {
    const w = window_();
    w.main.inert = true;
    popLayer(pushLayer(w.settings));
    expect([w.main.inert, w.tabrow.inert]).toEqual([true, false]);
  });
});
