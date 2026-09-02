export interface CsvColumn<T> {
  key: string;
  label: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

// Quote any field containing a comma, quote, or newline, and escape
// embedded quotes by doubling them -- the standard CSV escaping rule
// (RFC 4180), enough for the flat, ASCII-ish data this app deals with.
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = c.value(row);
        return escapeCsvField(v === null || v === undefined ? "" : String(v));
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // Leading BOM so Excel (still the most likely destination for these)
  // detects UTF-8 correctly instead of mangling the ₦ sign.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
