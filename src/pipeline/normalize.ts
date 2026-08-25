/**
 * Merge Crunchbase + Clutch, normalize domain, filter ICP geo/headcount,
 * dedupe by domain. Missing website is kept with needs_domain_lookup=true for
 * Clay to resolve.
 * Ambiguous bands: Clutch "10 - 49" (floor 11), "50 - 249" (ceiling 200),
 * Crunchbase "101-250". Do not invent a midpoint.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CountrySchema, type Company } from "../icp.js";
import { toCsvField } from "./csv.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const CLUTCH_REL = path.join("data", "raw", "clutch.json");
const CRUNCHBASE_REL = path.join("data", "raw", "crunchbase.json");
const OUTPUT_REL = path.join("data", "companies.csv");

const ICP_COUNTRIES = new Set(CountrySchema.options);
const ICP_MIN = 11;
const ICP_MAX = 200;
const FUNDING_USD_CEILING = 20_000_000;

export type HeadcountBand = {
  raw: string;
  low: number;
  high: number | null;
  ambiguous: boolean;
};

export type NormalizedRow = {
  name: string;
  domain: string;
  country: Company["country"];
  headcount: number | null;
  headcount_raw: string;
  headcount_low_edge: number;
  headcount_high_edge: number | null;
  headcount_ambiguous: boolean;
  needs_domain_lookup: boolean;
  company_type: Company["company_type"];
  funding_usd: number | null;
  source: Company["source"];
  origin_url: string;
};

type ClutchRaw = {
  name?: string | null;
  website?: string | null;
  size?: string | null;
  country?: string | null;
  clutch_category?: string | null;
  category?: string | null;
  url?: string | null;
  origin_url?: string | null;
  source?: string | null;
};

type CrunchbaseRaw = {
  name?: string | null;
  domain?: string | null;
  country?: string | null;
  headcount?: string | number | null;
  industry?: string | null;
  funding?: string | number | null;
  url?: string | null;
  origin_url?: string | null;
  source?: string | null;
};

const CLUTCH_TYPE: Record<string, Company["company_type"]> = {
  "digital-marketing": "digital_marketing_agency",
  "lead-generation": "lead_gen_agency",
  "sales-outsourcing": "sales_consulting",
};

export function normalizeDomain(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed || /^mailto:/i.test(trimmed)) return "";
  try {
    const withProto = /:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProto).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    if (!host || !host.includes(".")) return "";
    if (host === "clutch.co" || host.endsWith(".clutch.co")) return "";
    if (host === "crunchbase.com" || host.endsWith(".crunchbase.com"))
      return "";
    return host;
  } catch {
    return "";
  }
}

export function parseHeadcountBand(
  raw: string | number | null | undefined,
): HeadcountBand | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const n = Math.trunc(raw);
    return {
      raw: String(n),
      low: n,
      high: n,
      ambiguous: n < ICP_MIN || n > ICP_MAX,
    };
  }
  const text = String(raw).replace(/,/g, "").trim();
  if (!text || /freelancer|self[- ]?employed|unknown/i.test(text)) return null;
  const plus = text.match(/^(\d+)\s*\+$/);
  if (plus) {
    const low = Number(plus[1]);
    return {
      raw: String(raw).trim(),
      low,
      high: null,
      ambiguous: low <= ICP_MAX,
    };
  }
  const range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!range) {
    const single = text.match(/(\d+)/);
    if (!single) return null;
    const n = Number(single[1]);
    return {
      raw: String(raw).trim(),
      low: n,
      high: n,
      ambiguous: n < ICP_MIN || n > ICP_MAX,
    };
  }
  const low = Number(range[1]);
  const high = Number(range[2]);
  const ambiguous =
    (low < ICP_MIN && high >= ICP_MIN) || (low <= ICP_MAX && high > ICP_MAX);
  return { raw: String(raw).trim(), low, high, ambiguous };
}

export function isClearlyOutsideIcp(band: HeadcountBand): boolean {
  if (band.high != null && band.high < ICP_MIN) return true;
  if (band.low > ICP_MAX) return true;
  return false;
}

export function inferCompanyType(
  industry: string | null | undefined,
): Company["company_type"] | null {
  if (!industry) return null;
  const text = industry.toLowerCase();
  if (/lead gen|demand gen|appointment setting/.test(text))
    return "lead_gen_agency";
  if (/advertis|marketing|seo|brand|media|agency/.test(text))
    return "digital_marketing_agency";
  if (/consult|professional services|sales training/.test(text))
    return "sales_consulting";
  if (/saas|software|b2b/.test(text)) return "b2b_saas";
  return null;
}

export function clutchCategoryToType(
  slug: string | null | undefined,
): Company["company_type"] | null {
  if (!slug) return null;
  return CLUTCH_TYPE[slug] ?? null;
}

function asCountry(raw: string | null | undefined): Company["country"] | null {
  if (!raw) return null;
  const parsed = CountrySchema.safeParse(raw.trim());
  return parsed.success ? parsed.data : null;
}

export function parseFundingUsd(
  raw: string | number | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const digits = String(raw).replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function exceedsFundingCeiling(fundingUsd: number | null): boolean {
  return fundingUsd != null && fundingUsd > FUNDING_USD_CEILING;
}

function fromBand(
  name: string,
  domain: string,
  country: Company["country"],
  band: HeadcountBand,
  companyType: Company["company_type"],
  source: Company["source"],
  originUrl: string,
  fundingUsd: number | null,
): NormalizedRow {
  return {
    name,
    domain,
    country,
    headcount: band.ambiguous ? null : band.low,
    headcount_raw: band.raw,
    headcount_low_edge: band.low,
    headcount_high_edge: band.high,
    headcount_ambiguous: band.ambiguous,
    needs_domain_lookup: domain.length === 0,
    company_type: companyType,
    funding_usd: fundingUsd,
    source,
    origin_url: originUrl,
  };
}

export function normalizeClutchRow(row: ClutchRaw): NormalizedRow | null {
  const name = (row.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  const country = asCountry(row.country);
  if (!country) return null;
  const companyType = clutchCategoryToType(row.clutch_category ?? row.category);
  if (!companyType) return null;
  const band = parseHeadcountBand(row.size);
  if (!band || isClearlyOutsideIcp(band)) return null;
  const domain = normalizeDomain(row.website);
  const origin = row.origin_url || row.url || "";
  if (!origin) return null;
  return fromBand(
    name,
    domain,
    country,
    band,
    companyType,
    "clutch",
    origin,
    null,
  );
}

export function normalizeCrunchbaseRow(
  row: CrunchbaseRaw,
): NormalizedRow | null {
  const name = (row.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  const country = asCountry(row.country);
  if (!country) return null;
  const companyType = inferCompanyType(row.industry);
  if (!companyType) return null;
  const band = parseHeadcountBand(row.headcount);
  if (!band || isClearlyOutsideIcp(band)) return null;
  const fundingUsd = parseFundingUsd(row.funding);
  if (exceedsFundingCeiling(fundingUsd)) return null;
  const domain = normalizeDomain(row.domain);
  const origin = row.origin_url || row.url || "";
  if (!origin) return null;
  return fromBand(
    name,
    domain,
    country,
    band,
    companyType,
    "crunchbase",
    origin,
    fundingUsd,
  );
}

export function dedupeByDomain(rows: NormalizedRow[]): NormalizedRow[] {
  const byDomain = new Map<string, NormalizedRow>();
  const withoutDomain: NormalizedRow[] = [];
  const seenNoDomain = new Set<string>();
  for (const row of rows) {
    if (!row.domain) {
      const key = `${row.name.toLowerCase()}|${row.country}|${row.origin_url}`;
      if (seenNoDomain.has(key)) continue;
      seenNoDomain.add(key);
      withoutDomain.push(row);
      continue;
    }
    if (byDomain.has(row.domain)) continue;
    byDomain.set(row.domain, row);
  }
  return [...byDomain.values(), ...withoutDomain];
}

export function toCsv(rows: NormalizedRow[]): string {
  const headers = [
    "name",
    "domain",
    "country",
    "headcount",
    "headcount_raw",
    "headcount_low_edge",
    "headcount_high_edge",
    "headcount_ambiguous",
    "needs_domain_lookup",
    "company_type",
    "funding_usd",
    "source",
    "origin_url",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.domain,
        row.country,
        row.headcount,
        row.headcount_raw,
        row.headcount_low_edge,
        row.headcount_high_edge,
        row.headcount_ambiguous,
        row.needs_domain_lookup,
        row.company_type,
        row.funding_usd,
        row.source,
        row.origin_url,
      ]
        .map(toCsvField)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** A missing capture means that scraper has not run. It is skipped with a
 * message rather than treated as an empty result. */
async function readCaptureOrEmpty<T>(rel: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(path.join(REPO_ROOT, rel), "utf8")) as T[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    console.log(`No capture at ${rel}, skipping that source.`);
    return [];
  }
}

export async function runNormalize(): Promise<{
  rows: NormalizedRow[];
  outPath: string;
}> {
  const clutchRaw = await readCaptureOrEmpty<ClutchRaw>(CLUTCH_REL);
  const crunchRaw = await readCaptureOrEmpty<CrunchbaseRaw>(CRUNCHBASE_REL);
  if (clutchRaw.length === 0 && crunchRaw.length === 0) {
    throw new Error(
      `No captures in data/raw/. Run pnpm scrape:clutch or pnpm scrape:crunchbase first. ${OUTPUT_REL} was left untouched.`,
    );
  }
  const clutch = clutchRaw
    .map(normalizeClutchRow)
    .filter((r): r is NormalizedRow => r != null);
  const crunch = crunchRaw
    .map(normalizeCrunchbaseRow)
    .filter((r): r is NormalizedRow => r != null);
  const rows = dedupeByDomain([...clutch, ...crunch]);
  const outPath = path.join(REPO_ROOT, OUTPUT_REL);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, toCsv(rows), "utf8");
  const lookup = rows.filter((r) => r.needs_domain_lookup).length;
  const ambiguous = rows.filter((r) => r.headcount_ambiguous).length;
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const row of rows) {
    byType[row.company_type] = (byType[row.company_type] || 0) + 1;
    bySource[row.source] = (bySource[row.source] || 0) + 1;
  }
  console.log(
    `Wrote ${rows.length} to ${OUTPUT_REL} sources=${JSON.stringify(bySource)} types=${JSON.stringify(byType)} needs_domain_lookup=${lookup} headcount_ambiguous=${ambiguous}`,
  );
  return { rows, outPath };
}

const isDirect =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  runNormalize().catch((err: unknown) => {
    const message =
      err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(message);
    process.exit(1);
  });
}
