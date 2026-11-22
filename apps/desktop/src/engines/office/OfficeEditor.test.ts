// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { isForwardedKey, officeOriginOf } from "./OfficeEditor";

describe("Office editor messages", () => {
  it("accepts only the shortcuts the bridge forwards", () => {
    expect(isForwardedKey({ key: "k", ctrlKey: true })).toBe(true);
    expect(isForwardedKey({ key: "Tab", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(isForwardedKey({ key: "S", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(isForwardedKey({ key: "F11" })).toBe(true);
    // Not forwarded by the bridge: refused even if a document sends them.
    expect(isForwardedKey({ key: "F", ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isForwardedKey({ key: "Escape" })).toBe(false);
    expect(isForwardedKey({ key: "s", ctrlKey: true })).toBe(false);
    expect(isForwardedKey({ key: "k" })).toBe(false);
    expect(isForwardedKey({ key: 42 as unknown as string, ctrlKey: true })).toBe(false);
  });
  it("derives the editor origin for custom schemes", () => {
    expect(officeOriginOf("office://t0a1b2c3.localhost/editor?x=1")).toBe("office://t0a1b2c3.localhost");
    expect(officeOriginOf("http://office.t0a1b2c3.localhost/editor")).toBe("http://office.t0a1b2c3.localhost");
  });
});
