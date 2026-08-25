/** Minimal RFC 4180 reader and writer for the pipeline's CSV files. Handles
 * quoted fields and doubled quotes. Does not handle a newline inside a field,
 * which none of these files contain. */
import { readFile } from "node:fs/promises";

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.replace(/\r$/, "").trim());
}

/** A cell that starts with = + - @ or a tab runs as a formula when the file
 * opens in Excel or Sheets (CWE-1236). Every text field here comes from a
 * scraped page or an enrichment vendor, so the leading character is
 * neutralized with a quote, which spreadsheets read as "this is text". */
export function toCsvField(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function readCsv(
  file: string,
): Promise<Array<Record<string, string>>> {
  const lines = (await readFile(file, "utf8")).trim().split("\n");
  const header = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(
      header.map((key, idx) => [key, cells[idx] ?? ""]),
    );
  });
}
