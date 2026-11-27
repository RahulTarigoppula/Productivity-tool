import { describe, it, expect } from "vitest";
import { formatNumber, general, asNumberCell, BUILTIN_FORMATS, parseAmount } from "./numfmt";

describe("number formats", () => {
  it("shows numbers the way Excel's common formats do", () => {
    const cases: [number, string, string][] = [
      [1.1, "0.00", "1.10"],
      [1234567.891, "#,##0.00", "1,234,567.89"],
      [-2.5, "0.00", "-2.50"],
      [-2.5, "0.00_);(0.00)", "(2.50)"],
      [0.125, "0.0%", "12.5%"],
      [0.12, "0%", "12%"],
      [1200, "$#,##0", "$1,200"],
      [3.5, '[$€-407] #,##0.00', "€ 3.50"],
      [12, '0 "kg"', "12 kg"],
      [123456, "0.00E+00", "1.23E+05"],
      [3.14159, "0.0#", "3.14"],
      [3.1, "0.0#", "3.1"],
      [46037, "yyyy-mm-dd", "2026-01-15"],
      [46037, "m/d/yyyy", "2026-01-15"],
      [46037.5, "m/d/yyyy h:mm", "2026-01-15 12:00"],
      [0.75, "h:mm:ss", "18:00:00"],
      [1.5, "[h]:mm", "36:00"],
      [59, "yyyy-mm-dd", "1900-02-28"],
      [61, "yyyy-mm-dd", "1900-03-01"],
      [-5, "yyyy-mm-dd", "-5"],
      [42, "@", "42"],
    ];
    for (const [v, code, want] of cases) expect(formatNumber(v, code), `${v} as ${code}`).toBe(want);
  });

  it("General hides floating-point noise and uses Excel's scientific style", () => {
    expect(general(0.1 + 0.2)).toBe("0.3");
    expect(general(1650)).toBe("1650");
    expect(general(123456789012)).toBe("1.23457E+11");
    expect(general(0.000015)).toBe("0.000015");
  });

  it("stores typed values as numbers only when they still show exactly as typed", () => {
    expect(asNumberCell("10.5")).toEqual({ value: 10.5, format: null });
    expect(asNumberCell("1.10")).toEqual({ value: 1.1, format: "0.00" });
    expect(asNumberCell("-2.50")).toEqual({ value: -2.5, format: "0.00" });
    expect(asNumberCell("12%")).toEqual({ value: 0.12, format: "0%" });
    expect(asNumberCell("12.5%")).toEqual({ value: 0.125, format: "0.0%" });
    expect(asNumberCell("2026-01-15")).toEqual({ value: 46037, format: "yyyy-mm-dd" });
    for (const v of ["00012", "-0", "4006381333931", "2026-02-30", "1899-12-31", "1e5", "1,2", "12 %", "0.1234567890123456789", " 4"]) expect(asNumberCell(v), v).toBeNull();
    for (const v of ["1.10", "0.10", "-2.50", "12%", "12.5%", "-3%", "2026-01-15", "99999999999", "1,200", "$1,200.50"]) {
      const c = asNumberCell(v)!;
      expect(c.format ? formatNumber(c.value, c.format) : general(c.value), v).toBe(v);
    }
  });
});

describe("format codes this does not draw, and crafted ones", () => {
  it("shows the plain number for fractions and thousands scaling instead of a wrong one", () => {
    expect(formatNumber(0.5, "# ?/?")).toBe("0.5");
    expect(formatNumber(1.5, BUILTIN_FORMATS[13])).toBe("1.5");
    expect(formatNumber(1234567, '#,##0,,"M"')).toBe("1234567");
    expect(formatNumber(1234567, "0.0,")).toBe("1234567");
    // Ordinary grouping still works.
    expect(formatNumber(1234567, "#,##0")).toBe("1,234,567");
    expect(formatNumber(1234.5, "#,##0.00")).toBe("1,234.50");
  });

  it("never throws or stalls on odd codes", () => {
    expect(() => formatNumber(12345, "0." + "0".repeat(150) + "E+00")).not.toThrow();
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) formatNumber(5, "[".repeat(20000));
    formatNumber(5, "0" + '"x"'.repeat(20000));
    expect(Date.now() - t0).toBeLessThan(500);
  });
});

describe("amounts", () => {
  it("reads currency, grouping, accounting negatives and European decimals", () => {
    expect(parseAmount("$1,200.50")).toBe(1200.5);
    expect(parseAmount("€ 300")).toBe(300);
    expect(parseAmount("(500)")).toBe(-500);
    expect(parseAmount("-$45.10")).toBe(-45.1);
    expect(parseAmount("12%")).toBe(12);
    expect(parseAmount("1.234,00", true)).toBe(1234);
    expect(parseAmount("2,50", true)).toBe(2.5);
    expect(parseAmount("1,2")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("stores typed amounts as numbers for Excel, shown exactly as typed", () => {
    expect(asNumberCell("$1,200.50")).toEqual({ value: 1200.5, format: '"$"#,##0.00' });
    expect(asNumberCell("$300.00")).toEqual({ value: 300, format: '"$"0.00' });
    expect(asNumberCell("12,000")).toEqual({ value: 12000, format: "#,##0" });
    expect(asNumberCell("-€45.10")).toEqual({ value: -45.1, format: '"€"0.00' });
    expect(asNumberCell("1,2,3")).toBeNull();
    expect(asNumberCell("$")).toBeNull();
  });
});
