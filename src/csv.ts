// CSV exports may contain quoted commas and newlines. Reject malformed input.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw Error("Malformed CSV quote");
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
      }
      continue;
    }
    if (closed) throw Error("Unexpected text after CSV quote");
    cell += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  if (cell || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows.shift()!;
  if (header.some((h) => !h) || new Set(header).size !== header.length)
    throw Error("CSV headers must be nonempty and unique");
  return rows.map((r) => {
    if (r.length !== header.length)
      throw Error("CSV column count differs from header");
    return Object.fromEntries(header.map((h, i) => [h, r[i]]));
  });
}
export function csvField(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]|^[\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  return (
    [
      keys.map(csvField).join(","),
      ...rows.map((r) => keys.map((k) => csvField(r[k])).join(",")),
    ].join("\n") + "\n"
  );
}
export function importCsv(text: string) {
  return parseCsv(text).map((r) => {
    const columns = [
      "company",
      "domain",
      "country",
      "industry",
      "employees",
      "source",
      "contact_name",
      "contact_role",
      "email",
      "email_status",
      "evidence_json",
      "suppressed",
    ];
    if (Object.keys(r).some((key) => !columns.includes(key)))
      throw Error("Unknown CSV header; map provider fields explicitly");
    const hasContact = [
      r.contact_name,
      r.contact_role,
      r.email,
      r.email_status,
    ].some((s) => s?.trim());
    if (hasContact && (!r.contact_name?.trim() || !r.contact_role?.trim()))
      throw Error(
        "Partial contact: name and role are required when contact fields are supplied",
      );
    if (r.suppressed && !["true", "false"].includes(r.suppressed))
      throw Error("suppressed must be true or false");
    return {
      company: r.company,
      domain: r.domain,
      country: r.country || undefined,
      industry: r.industry || undefined,
      employees: r.employees ? Number(r.employees) : undefined,
      source: r.source,
      suppressed: r.suppressed === "true",
      contact: r.contact_name
        ? {
            name: r.contact_name,
            role: r.contact_role,
            email: r.email || undefined,
            emailStatus: r.email_status || "unknown",
          }
        : undefined,
      evidence: JSON.parse(r.evidence_json || "[]"),
    };
  });
}
