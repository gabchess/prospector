/**
 * Clutch directory scraper (Playwright, headed first).
 *
 * Categories: digital-marketing, lead-generation, sales-outsourcing.
 * Cap 200 per listing. clutch_category is the listing slug; normalize maps it
 * to company_type. services stays null, not in CompanySchema; the category URL
 * is the type. Cloudflare 403 after a real headed attempt: stop, log the Apify
 * memo23/apify-clutch-cheerio fallback, never run it silently.
 * Lessons carried over from the Crunchbase scraper: no content-type filter on
 * the API sniffer, Next is an <a>, kill switch outside page.on, null-rate check
 * before write.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Page, type Response } from "playwright";
import { isScalar, scalarText } from "./scalars.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_REL = path.join("data", "raw", "clutch.json");
const MAX_PER_CATEGORY =
  Number(process.env.CLUTCH_MAX_PER_CATEGORY || "") || 200;
const RATE_LIMIT_MS = 2000;
const NAV_TIMEOUT_MS = 60_000;
const VIEWPORT = { width: 1440, height: 900 } as const;
const SOURCE = "clutch" as const;

const LISTINGS: { category: string; url: string }[] = [
  {
    category: "digital-marketing",
    url: "https://clutch.co/agencies/digital-marketing",
  },
  {
    category: "lead-generation",
    url: "https://clutch.co/call-centers/lead-generation",
  },
  {
    category: "sales-outsourcing",
    url: "https://clutch.co/call-centers/sales-outsourcing",
  },
];
const ICP_COUNTRIES = new Set(["US", "UK", "CA", "AU"]);

export type ClutchRawCompany = {
  name: string;
  website: string | null;
  size: string | null;
  headquarters: string | null;
  country: string | null;
  rating: string | null;
  services: string | null;
  url: string;
  category: string;
  clutch_category: string;
  source: typeof SOURCE;
  origin_url: string;
  captured_at: string;
};

type ExtractedRow = {
  name: string | null;
  website: string | null;
  size: string | null;
  headquarters: string | null;
  country: string | null;
  rating: string | null;
  services: string | null;
  url: string | null;
};

type KillReason = "blocked" | "layout_break";

class KillSwitchError extends Error {
  readonly reason: KillReason;
  constructor(reason: KillReason, message: string) {
    super(message);
    this.name = "KillSwitchError";
    this.reason = reason;
  }
}

type ApiKillBox = { error: KillSwitchError | null };

function nowIso(): string {
  return new Date().toISOString();
}

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (isScalar(v)) return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (isScalar(o.value)) return String(o.value);
    if (isScalar(o.name)) return String(o.name);
    if (isScalar(o.url)) return String(o.url);
  }
  return null;
}

function isClutchHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "clutch.co" || host.endsWith(".clutch.co");
}

function unwrapClutchRedirect(raw: string): string {
  try {
    const parsed = new URL(raw, "https://clutch.co");
    if (
      parsed.hostname === "r.clutch.co" ||
      parsed.pathname.includes("redirect")
    ) {
      const dest = parsed.searchParams.get("u");
      if (dest) return dest;
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = unwrapClutchRedirect(raw.trim());
  if (!trimmed || /^mailto:/i.test(trimmed)) return null;
  try {
    const withProto = /:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProto).hostname.toLowerCase();
    if (!host || isClutchHost(host)) return null;
    const stripped = host.replace(/^www\./, "");
    return stripped.includes(".") ? stripped : null;
  } catch {
    const fallback = trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    if (!fallback || !fallback.includes(".") || isClutchHost(fallback)) {
      return null;
    }
    return fallback;
  }
}

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "US",
  usa: "US",
  us: "US",
  "united kingdom": "UK",
  uk: "UK",
  england: "UK",
  scotland: "UK",
  wales: "UK",
  "northern ireland": "UK",
  canada: "CA",
  australia: "AU",
  au: "AU",
};
const US_STATES = new Set([
  "al",
  "ak",
  "az",
  "ar",
  "ca",
  "co",
  "ct",
  "de",
  "fl",
  "ga",
  "hi",
  "id",
  "il",
  "in",
  "ia",
  "ks",
  "ky",
  "la",
  "me",
  "md",
  "ma",
  "mi",
  "mn",
  "ms",
  "mo",
  "mt",
  "ne",
  "nv",
  "nh",
  "nj",
  "nm",
  "ny",
  "nc",
  "nd",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "vt",
  "va",
  "wa",
  "wv",
  "wi",
  "wy",
  "dc",
]);
const CA_PROVINCES = new Set([
  "on",
  "qc",
  "bc",
  "ab",
  "mb",
  "sk",
  "ns",
  "nb",
  "nl",
  "pe",
  "nt",
  "yt",
  "nu",
]);
const AU_STATES = new Set([
  "nsw",
  "vic",
  "qld",
  "wa",
  "sa",
  "tas",
  "act",
  "nt",
]);

function countryFromHq(hq: string | null | undefined): string | null {
  if (!hq) return null;
  const last = hq
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .pop();
  if (!last) return null;
  const key = last.toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (US_STATES.has(key)) return "US";
  if (CA_PROVINCES.has(key)) return "CA";
  if (AU_STATES.has(key)) return "AU";
  return last;
}

function companyUrl(href: string | null): string | null {
  if (!href) return null;
  try {
    const abs = new URL(href, "https://clutch.co");
    if (!isClutchHost(abs.hostname)) return null;
    if (!abs.pathname.includes("/profile/")) return null;
    abs.hash = "";
    abs.search = "";
    return abs.toString();
  } catch {
    return null;
  }
}

function toRecord(
  row: ExtractedRow,
  category: string,
  capturedAt: string,
): ClutchRawCompany | null {
  const name = row.name?.replace(/\s+/g, " ").trim() ?? "";
  if (!name) return null;
  const url = companyUrl(row.url);
  if (!url) return null;
  const headquarters = row.headquarters?.replace(/\s+/g, " ").trim() || null;
  return {
    name,
    website: normalizeDomain(row.website),
    size: row.size?.replace(/\s+/g, " ").trim() || null,
    headquarters,
    country: row.country?.trim() || countryFromHq(headquarters),
    rating: row.rating?.replace(/\s+/g, " ").trim() || null,
    services: null,
    url,
    category,
    clutch_category: category,
    source: SOURCE,
    origin_url: url,
    captured_at: capturedAt,
  };
}

function looksBlocked(url: string, title: string, text: string): boolean {
  const blob = `${url}\n${title}\n${text}`.toLowerCase();
  return [
    "captcha",
    "just a moment",
    "attention required",
    "verify you are",
    "access denied",
    "cf-browser",
    "checking your browser",
    "sorry, you have been blocked",
  ].some((n) => blob.includes(n));
}

async function assertPageSafe(page: Page): Promise<void> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const text = await page
    .evaluate(() => (document.body?.innerText ?? "").slice(0, 3000))
    .catch(() => "");
  if (looksBlocked(url, title, text)) {
    throw new KillSwitchError(
      "blocked",
      `KILL SWITCH: Cloudflare/block on ${url} title=${title}. Headed attempt done. Apify memo23/apify-clutch-cheerio is the logged fallback — not firing it from here without a confirmed 403 + token. Stopping.`,
    );
  }
}

function isLikelyListApi(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isClutchHost(parsed.hostname)) return false;
    const u = `${parsed.pathname}${parsed.search}`.toLowerCase();
    return (
      u.includes("/api") ||
      u.includes("directory") ||
      u.includes("providers") ||
      u.includes("search")
    );
  } catch {
    return false;
  }
}

function collectFromJson(
  node: unknown,
  out: ExtractedRow[],
  seen: Set<string>,
  depth = 0,
): void {
  if (depth > 10 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectFromJson(item, out, seen, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const name = scalarText(obj.name, obj.title, obj.company_name);
  const slug = scalarText(obj.slug, obj.profile_url, obj.url);
  if (name && slug) {
    const url = companyUrl(
      slug.includes("/profile/") ? slug : `/profile/${slug}`,
    );
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push({
        name,
        website:
          asText(obj.website) ??
          asText(obj.domain) ??
          asText(obj.company_website),
        size:
          asText(obj.employees) ?? asText(obj.company_size) ?? asText(obj.size),
        headquarters:
          asText(obj.location) ?? asText(obj.headquarters) ?? asText(obj.city),
        country: asText(obj.country),
        rating: asText(obj.rating) ?? asText(obj.avg_rating),
        services: Array.isArray(obj.services)
          ? obj.services
              .map(asText)
              .filter((s): s is string => Boolean(s))
              .slice(0, 6)
              .join("; ")
          : asText(obj.services),
        url,
      });
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && key !== "identifier") {
      collectFromJson(value, out, seen, depth + 1);
    }
  }
}

function attachSniffer(
  page: Page,
  bucket: ExtractedRow[],
  apiKill: ApiKillBox,
): () => void {
  const seen = new Set<string>();
  const onResponse = async (response: Response): Promise<void> => {
    const url = response.url();
    if (response.status() === 403 || response.status() === 401) {
      if (url.includes("clutch.co") && !url.includes("cdn")) {
        apiKill.error = new KillSwitchError(
          "blocked",
          `KILL SWITCH: Clutch returned ${response.status()} at ${url}. Headed attempt done. Apify fallback is logged-only after a real 403; stopping for a human to confirm.`,
        );
      }
      return;
    }
    if (!response.ok()) return;
    if (!isLikelyListApi(url)) return;
    try {
      const text = await response.text();
      if (!text) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }
      const before = bucket.length;
      collectFromJson(parsed, bucket, seen);
      if (bucket.length > before) {
        console.log(
          `  sniffer +${bucket.length - before} (${text.length}b) ${url}`,
        );
      }
    } catch {
      /* body unreadable */
    }
  };
  page.on("response", onResponse);
  return () => page.off("response", onResponse);
}

type DomExtract = {
  rows: ExtractedRow[];
  emptyState: boolean;
  blocked: boolean;
  misses?: {
    cards: number;
    name: number;
    website: number;
    headquarters: number;
  };
};

async function extractFromDom(page: Page): Promise<DomExtract> {
  const extractJs = await readFile(
    new URL("./clutch-dom-extract.js", import.meta.url),
    "utf8",
  );
  return page.evaluate(extractJs) as Promise<DomExtract>;
}

function categoryCount(
  merged: Map<string, ClutchRawCompany>,
  category: string,
): number {
  let n = 0;
  for (const rec of merged.values()) {
    if (rec.clutch_category === category) n += 1;
  }
  return n;
}

function nullPctFor(
  records: ClutchRawCompany[],
  key: keyof ClutchRawCompany,
): number {
  if (records.length === 0) return 100;
  const empty = records.filter((r) => r[key] == null || r[key] === "").length;
  return Math.round((empty / records.length) * 100);
}

async function clickNextPage(page: Page): Promise<boolean> {
  const selectors = [
    'a[aria-label="Go to Next Page"]',
    "a.sg-pagination-v2-next:not(.sg-pagination-v2-disabled)",
    'a[aria-label="Next"]',
    'a[rel="next"]',
    "a.page-link.next",
    "a.next",
    'a:has-text("Next")',
    'button[aria-label="Next"]',
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    const count = await loc.count();
    console.log(`  next probe ${sel} count=${count}`);
    if (count === 0) continue;
    let enabled = false;
    try {
      enabled = await loc.isEnabled();
    } catch (err) {
      console.log(`  next probe ${sel} isEnabled threw: ${String(err)}`);
      continue;
    }
    let visible = false;
    try {
      visible = await loc.isVisible();
    } catch (err) {
      console.log(`  next probe ${sel} isVisible threw: ${String(err)}`);
      continue;
    }
    const ariaDisabled = await loc
      .getAttribute("aria-disabled")
      .catch((err) => {
        console.log(`  next probe ${sel} aria-disabled threw: ${String(err)}`);
        return null;
      });
    console.log(
      `  next probe ${sel} enabled=${enabled} visible=${visible} aria-disabled=${ariaDisabled}`,
    );
    if (!enabled || !visible || ariaDisabled === "true") continue;
    await loc.click({ timeout: 5000 });
    console.log(`  next probe clicked ${sel}`);
    return true;
  }
  console.log("  next probe: no clickable Next");
  return false;
}

async function writeOutput(records: ClutchRawCompany[]): Promise<string> {
  const outPath = path.join(REPO_ROOT, OUTPUT_REL);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return outPath;
}

async function scrape(): Promise<void> {
  const headed = process.env.CLUTCH_HEADLESS !== "1";
  console.log(
    `Clutch scraper starting. max_per_category=${MAX_PER_CATEGORY} headed=${headed} rate=${RATE_LIMIT_MS}ms`,
  );

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);

  const apiRows: ExtractedRow[] = [];
  const apiKill: ApiKillBox = { error: null };
  const detach = attachSniffer(page, apiRows, apiKill);
  const capturedAt = nowIso();
  const merged = new Map<string, ClutchRawCompany>();

  const ingest = (
    rows: ExtractedRow[],
    category: string,
    label: string,
  ): number => {
    let added = 0;
    for (const row of rows) {
      const rec = toRecord(row, category, capturedAt);
      if (!rec) continue;
      const key = rec.url.toLowerCase();
      if (merged.has(key)) continue;
      if (categoryCount(merged, category) >= MAX_PER_CATEGORY) return added;
      const country = rec.country;
      if (!country) {
        console.log(`  skip null country ${rec.name}`);
        continue;
      }
      if (!ICP_COUNTRIES.has(country)) {
        console.log(`  skip country=${country} ${rec.name}`);
        continue;
      }
      merged.set(key, rec);
      added += 1;
    }
    if (added) console.log(`  +${added} from ${label} (total ${merged.size})`);
    return added;
  };

  try {
    for (const listing of LISTINGS) {
      console.log(`Listing ${listing.category}: ${listing.url}`);
      await page.goto(listing.url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
      await page
        .waitForSelector("li.provider-list-item", { timeout: 20000 })
        .catch(() => null);
      await page.waitForTimeout(800);
      if (apiKill.error) throw apiKill.error;
      const listingTitle = await page.title().catch(() => "");
      if (/404|not found/i.test(listingTitle)) {
        console.log(`Skip 404 listing ${listing.category}: ${listing.url}`);
        ingest(apiRows, listing.category, "drain");
        apiRows.length = 0;
        continue;
      }
      await assertPageSafe(page);

      let pageIndex = 1;
      let addedInCategory = 0;
      while (categoryCount(merged, listing.category) < MAX_PER_CATEGORY) {
        if (apiKill.error) throw apiKill.error;
        await assertPageSafe(page);
        addedInCategory += ingest(
          apiRows,
          listing.category,
          `api ${listing.category} p${pageIndex}`,
        );
        apiRows.length = 0;
        const dom = await extractFromDom(page);
        if (dom.blocked) {
          throw new KillSwitchError(
            "blocked",
            `KILL SWITCH: block text on ${page.url()}. Stopping.`,
          );
        }
        if (dom.misses) {
          console.log(
            `  extract misses ${listing.category} p${pageIndex} cards=${dom.misses.cards} name=${dom.misses.name} website=${dom.misses.website} hq=${dom.misses.headquarters}`,
          );
        }
        addedInCategory += ingest(
          dom.rows,
          listing.category,
          `dom ${listing.category} p${pageIndex}`,
        );
        if (addedInCategory === 0 && pageIndex === 1 && !dom.emptyState) {
          throw new KillSwitchError(
            "layout_break",
            `KILL SWITCH: zero companies added for ${listing.category} on ${page.url()}. Layout may have changed.`,
          );
        }
        if (categoryCount(merged, listing.category) >= MAX_PER_CATEGORY) break;
        const moved = await clickNextPage(page);
        if (!moved) {
          console.log(
            `No Next on ${listing.category} after page ${pageIndex}.`,
          );
          break;
        }
        pageIndex += 1;
        console.log(
          `Rate limit ${RATE_LIMIT_MS}ms before ${listing.category} page ${pageIndex}`,
        );
        await sleep(RATE_LIMIT_MS);
      }
      ingest(apiRows, listing.category, "drain");
      apiRows.length = 0;
    }

    const records = [...merged.values()];
    const n = records.length;
    if (n === 0) {
      throw new KillSwitchError(
        "layout_break",
        "KILL SWITCH: zero companies. Not writing.",
      );
    }
    for (const listing of LISTINGS) {
      const subset = records.filter(
        (r) => r.clutch_category === listing.category,
      );
      const website = nullPctFor(subset, "website");
      const country = nullPctFor(subset, "country");
      const size = nullPctFor(subset, "size");
      const hq = nullPctFor(subset, "headquarters");
      console.log(
        `null rates ${listing.category} website=${website}% country=${country}% size=${size}% hq=${hq}% (n=${subset.length})`,
      );
      if (subset.length > 0 && website > 20) {
        throw new KillSwitchError(
          "layout_break",
          `KILL SWITCH: website ${website}% null in ${listing.category} (limit 20%). Not writing.`,
        );
      }
      const majorityNull =
        [country, size, hq].filter((p) => p > 50).length >= 2;
      if (subset.length > 0 && majorityNull) {
        throw new KillSwitchError(
          "layout_break",
          `KILL SWITCH: majority null in ${listing.category} (country=${country}% size=${size}% hq=${hq}%). Not writing.`,
        );
      }
    }
    const outPath = await writeOutput(records);
    console.log(`Wrote ${records.length} companies to ${outPath}`);
  } catch (err) {
    if (err instanceof KillSwitchError) {
      console.error(err.message);
      process.exitCode = 2;
      return;
    }
    throw err;
  } finally {
    detach();
    await browser.close();
  }
}

const isDirect =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  scrape().catch((err: unknown) => {
    const message =
      err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(message);
    process.exit(1);
  });
}
