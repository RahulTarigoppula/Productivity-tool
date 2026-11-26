import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toast, dismissToast, holdToasts, getState, setState } from "./store";

const texts = () => getState().toasts.map((t) => t.text);

describe("toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    holdToasts(false);
    for (const t of getState().toasts) dismissToast(t.id);
  });
  afterEach(() => {
    holdToasts(false);
    vi.useRealTimers();
  });

  it("go away on their own: messages after 4.5 s, errors after 8 s", () => {
    toast("Path copied");
    toast("Could not open", "error");
    vi.advanceTimersByTime(4400);
    expect(texts()).toEqual(["Path copied", "Could not open"]);
    vi.advanceTimersByTime(200);
    expect(texts()).toEqual(["Could not open"]);
    vi.advanceTimersByTime(3500);
    expect(texts()).toEqual([]);
  });

  it("with a button stay until used or dismissed", () => {
    toast("Exported plan.html", "info", { label: "Open", run: () => {} });
    vi.advanceTimersByTime(60_000);
    expect(texts()).toEqual(["Exported plan.html"]);
    dismissToast(getState().toasts[0].id);
    expect(texts()).toEqual([]);
  });

  it("stay while held (pointed at or focused), then get the rest of their time", () => {
    toast("Saved a copy");
    vi.advanceTimersByTime(4000);
    holdToasts(true);
    vi.advanceTimersByTime(30_000);
    expect(texts()).toEqual(["Saved a copy"]);
    holdToasts(false);
    // Only 0.5 s was left, but a toast never vanishes the moment it is let go.
    vi.advanceTimersByTime(1900);
    expect(texts()).toEqual(["Saved a copy"]);
    vi.advanceTimersByTime(200);
    expect(texts()).toEqual([]);
  });

  it("show the same message once, and at most four at a time", () => {
    toast("One");
    toast("One");
    expect(texts()).toEqual(["One"]);
    for (const t of ["Two", "Three", "Four", "Five"]) toast(t);
    expect(texts()).toEqual(["Two", "Three", "Four", "Five"]);
    vi.advanceTimersByTime(5000);
    expect(texts()).toEqual([]);
  });

  it("are not changed by other state updates", () => {
    toast("Kept");
    setState({ focusMode: false });
    expect(texts()).toEqual(["Kept"]);
  });
});
