import { describe, expect, it } from "vitest";
import { createCsv, escapeCsvValue } from "@/lib/csv";

describe("CSV export", () => {
  it("escapes quotes, commas and line breaks", () => {
    expect(escapeCsvValue('Perez, "Ana"\nCliente')).toBe('"Perez, ""Ana""\nCliente"');
  });

  it("prevents spreadsheet formula execution", () => {
    expect(escapeCsvValue("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
    expect(escapeCsvValue("+123")).toBe('"\'+123"');
  });

  it("creates an Excel-friendly UTF-8 file", () => {
    const result = createCsv(["Nombre", "Monto"], [["José", 125]]);
    expect(result.startsWith("\uFEFF")).toBe(true);
    expect(result).toContain('"José","125"');
    expect(result).toContain("\r\n");
  });
});
