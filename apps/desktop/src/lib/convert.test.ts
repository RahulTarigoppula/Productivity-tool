import { describe, it, expect } from "vitest";
import { ConversionRegistry, type Converter } from "./convert";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const conv = (from: string, to: string, quality: Converter["quality"], f: (s: string) => string): Converter => ({
  id: `${from}-${to}`,
  from,
  to,
  quality,
  run: async ({ bytes }) => ({ files: [{ suffix: "", bytes: enc(f(dec(bytes))) }] }),
});

describe("conversion routes", () => {
  const reg = new ConversionRegistry();
  reg.register(conv("xlsx", "csv", "good", (s) => s + "|csv"));
  reg.register(conv("csv", "json", "exact", (s) => s + "|json"));
  reg.register(conv("csv", "md", "good", (s) => s + "|md"));
  reg.register(conv("json", "csv", "exact", (s) => s + "|csv2"));
  reg.register(conv("xlsx", "md", "text", (s) => s + "|md-direct"));

  it("finds multi-step routes and labels them by the worst step", () => {
    const routes = reg.routes("xlsx");
    const json = routes.find((r) => r.to === "json")!;
    expect(json.steps.map((s) => s.id)).toEqual(["xlsx-csv", "csv-json"]);
    expect(json.quality).toBe("good");
  });

  it("prefers a better-quality route over a shorter one", () => {
    const md = reg.routes("xlsx").find((r) => r.to === "md")!;
    expect(md.steps.map((s) => s.id)).toEqual(["xlsx-csv", "csv-md"]);
  });

  it("never routes back to the source format", () => {
    expect(reg.routes("csv").some((r) => r.to === "csv")).toBe(false);
  });

  it("runs the steps in order", async () => {
    const route = reg.routes("xlsx").find((r) => r.to === "json")!;
    const out = await reg.run(route, { bytes: enc("x"), name: "a.xlsx" });
    expect(dec(out.files[0].bytes)).toBe("x|csv|json");
  });
});
