export type CsvValue = string | number | boolean | null | undefined;

function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function escapeCsvValue(value: CsvValue) {
  const normalized = protectSpreadsheetFormula(value == null ? "" : String(value));
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function createCsv(headers: string[], rows: CsvValue[][]) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")}`;
}

export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
