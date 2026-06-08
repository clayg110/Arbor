// RFC-4180 CSV serialization. Pure + dependency-free. Quotes any cell containing
// a comma, quote, or newline (doubling embedded quotes), and defends against CSV
// formula injection: a *string* cell starting with =, +, -, @ (or a control
// char) is prefixed with a single quote so spreadsheet apps don't execute it.
// Numbers pass through untouched so legitimate negatives aren't mangled.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const isString = typeof value === "string";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (isString && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  }
  return lines.join("\r\n");
}
