/**
 * Crunchbase saved-search scraper (Playwright, logged-in storageState).
 *
 * Do not run until .crunchbase.storageState.json and a search URL exist.
 * Kill switch: CAPTCHA / block / login wall → stop. No retry, no Apify, no plan B.
 * Never creates an account or fills payment.
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Page, type Response } from "playwright";
import { isScalar, scalarText } from "./scalars.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const STORAGE_STATE_FILE = ".crunchbase.storageState.json";
const SEARCH_URL_FILE = ".crunchbase.search-url";
const OUTPUT_REL = path.join("data", "raw", "crunchbase.json");
const MAX_COMPANIES = 300;
const MAX_PAGES =
  Number(process.env.CRUNCHBASE_MAX_PAGES || "") || Number.POSITIVE_INFINITY;
const RATE_LIMIT_MS = 2000;
const NAV_TIMEOUT_MS = 60_000;
const VIEWPORT = { width: 1440, height: 900 } as const;
const SOURCE = "crunchbase" as const;

export type CrunchbaseRawCompany = {
  name: string;
  domain: string | null;
  country: string | null;
  headquarters: string | null;
  headcount: string | number | null;
  industry: string | null;
  funding: string | null;
  url: string;
  source: typeof SOURCE;
  origin_url: string;
  captured_at: string;
};

type ExtractedRow = {
  name: string | null;
  domain: string | null;
  country: string | null;
  headquarters: string | null;
  headcount: string | number | null;
  industry: string | null;
  funding: string | null;
  url: string | null;
  permalink: string | null;
};

type KillReason = "blocked" | "session_expired" | "layout_break";

class KillSwitchError extends Error {
  readonly reason: KillReason;
  constructor(reason: KillReason, message: string) {
    super(message);
    this.name = "KillSwitchError";
    this.reason = reason;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isCrunchbaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "crunchbase.com" || host.endsWith(".crunchbase.com");
}

function assertCrunchbaseSearchUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`Search URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(`Search URL must be http(s): ${raw}`);
  }
  if (!isCrunchbaseHost(parsed.hostname)) {
    fail(`Search URL must be on crunchbase.com (got ${parsed.hostname}).`);
  }
  return parsed.toString();
}

async function resolveSearchUrl(): Promise<string> {
  const fromEnv = process.env.CRUNCHBASE_SEARCH_URL?.trim();
  if (fromEnv) return assertCrunchbaseSearchUrl(fromEnv);
  const filePath = path.join(REPO_ROOT, SEARCH_URL_FILE);
  if (await fileExists(filePath)) {
    const text = await readFile(filePath, "utf8");
    const line = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("#"));
    if (line) return assertCrunchbaseSearchUrl(line);
  }
  fail(
    `No saved-search URL. Set CRUNCHBASE_SEARCH_URL or write one line to ${SEARCH_URL_FILE} (gitignored).`,
  );
}

async function resolveStorageStatePath(): Promise<string> {
  const filePath = path.join(REPO_ROOT, STORAGE_STATE_FILE);
  if (!(await fileExists(filePath))) {
    fail(
      `Missing Playwright session file ${STORAGE_STATE_FILE}. Save storageState there after a manual browser login. Do not commit it.`,
    );
  }
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("cookies" in parsed || "origins" in parsed)
    ) {
      fail(`${STORAGE_STATE_FILE} is not a Playwright storageState JSON.`);
    }
  } catch (err) {
    if (err instanceof SyntaxError)
      fail(`${STORAGE_STATE_FILE} is not valid JSON.`);
    throw err;
  }
  return filePath;
}

function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^mailto:/i.test(trimmed)) return null;
  try {
    const withProto = /:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProto).hostname.toLowerCase();
    if (!host || isCrunchbaseHost(host)) return null;
    const stripped = host.replace(/^www\./, "");
    return stripped.includes(".") ? stripped : null;
  } catch {
    const fallback = trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    if (!fallback || !fallback.includes(".") || isCrunchbaseHost(fallback)) {
      return null;
    }
    return fallback;
  }
}

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  us: "US",
  "united kingdom": "UK",
  uk: "UK",
  "great britain": "UK",
  england: "UK",
  scotland: "UK",
  wales: "UK",
  canada: "CA",
  ca: "CA",
  australia: "AU",
  au: "AU",
};

function countryFromHq(hq: string | null | undefined): string | null {
  if (!hq) return null;
  const parts = hq
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1]!;
  return COUNTRY_ALIASES[last.toLowerCase()] ?? last;
}

const EMPLOYEE_ENUM: Record<string, string> = {
  c_00001_00010: "1-10",
  c_00011_00050: "11-50",
  c_00051_00100: "51-100",
  c_00101_00250: "101-250",
  c_00251_00500: "251-500",
  c_00501_01000: "501-1000",
  c_01001_05000: "1001-5000",
  c_05001_10000: "5001-10000",
  c_10001_max: "10001+",
};

function normalizeHeadcount(
  raw: string | number | null | undefined,
): string | number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw).trim();
  if (!text) return null;
  return EMPLOYEE_ENUM[text.toLowerCase()] ?? text;
}

function companyUrlFromPermalink(
  permalink: string | null,
  href: string | null,
): string | null {
  if (href) {
    try {
      const abs = new URL(href, "https://www.crunchbase.com");
      if (
        isCrunchbaseHost(abs.hostname) &&
        abs.pathname.includes("/organization/")
      ) {
        abs.hash = "";
        abs.search = "";
        return abs.toString();
      }
    } catch {
      /* ignore */
    }
  }
  if (permalink) {
    const slug = permalink
      .replace(/^\/+|\/+$/g, "")
      .replace(/^organization\//, "");
    if (slug) return `https://www.crunchbase.com/organization/${slug}`;
  }
  return null;
}

function toRecord(
  row: ExtractedRow,
  capturedAt: string,
): CrunchbaseRawCompany | null {
  const name = row.name?.replace(/\s+/g, " ").trim() ?? "";
  if (!name) return null;
  const url = companyUrlFromPermalink(row.permalink, row.url);
  if (!url) return null;
  const headquarters = row.headquarters?.replace(/\s+/g, " ").trim() || null;
  return {
    name,
    domain: normalizeDomain(row.domain),
    country: row.country?.trim() || countryFromHq(headquarters),
    headquarters,
    headcount: normalizeHeadcount(row.headcount),
    industry: row.industry?.replace(/\s+/g, " ").trim() || null,
    funding: row.funding?.replace(/\s+/g, " ").trim() || null,
    url,
    source: SOURCE,
    origin_url: url,
    captured_at: capturedAt,
  };
}

function urlLooksLikeLogin(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathName = parsed.pathname.toLowerCase();
    if (
      host.includes("accounts.") ||
      host.includes("auth.") ||
      host.startsWith("id.") ||
      host.includes("sso.")
    ) {
      return true;
    }
    if (
      isCrunchbaseHost(host) &&
      (pathName.includes("/login") ||
        pathName.includes("/signup") ||
        pathName.includes("/sign-up") ||
        pathName.includes("/register") ||
        pathName.includes("/signin"))
    ) {
      return true;
    }
    return false;
  } catch {
    return (
      url.toLowerCase().includes("login") ||
      url.toLowerCase().includes("signup")
    );
  }
}

type PageSignals = { url: string; title: string; textSample: string };

async function readPageSignals(page: Page): Promise<PageSignals> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const textSample = await page
    .evaluate(() => (document.body?.innerText ?? "").slice(0, 4000))
    .catch(() => "");
  return { url, title, textSample };
}

function looksBlocked(url: string, title: string, text: string): boolean {
  const blob = `${url}\n${title}\n${text}`.toLowerCase();
  const needles = [
    "captcha",
    "hcaptcha",
    "recaptcha",
    "challenge",
    "access denied",
    "unusual traffic",
    "just a moment",
    "attention required",
    "verify you are",
    "are you a human",
    "are you a robot",
    "cf-browser",
    "checking your browser",
    "pardon our interruption",
    "cdn-cgi/challenge",
    "blocked",
  ];
  return needles.some((n) => blob.includes(n));
}

function detectKill(signals: PageSignals): KillSwitchError | null {
  if (urlLooksLikeLogin(signals.url)) {
    return new KillSwitchError(
      "session_expired",
      `KILL SWITCH: session expired (login/signup redirect). URL: ${signals.url}. Re-save ${STORAGE_STATE_FILE}. This script does not sign in or open a trial.`,
    );
  }
  if (looksBlocked(signals.url, signals.title, signals.textSample)) {
    return new KillSwitchError(
      "blocked",
      `KILL SWITCH: block/challenge detected. URL: ${signals.url} Title: ${signals.title}. Stopping now. No retry, no rotation, no other source.`,
    );
  }
  return null;
}

async function assertPageSafe(page: Page): Promise<void> {
  const err = detectKill(await readPageSignals(page));
  if (err) throw err;
}

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (isScalar(v)) return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (isScalar(o.value)) return String(o.value);
    if (isScalar(o.name)) return String(o.name);
    if (isScalar(o.value_usd)) return `$${String(o.value_usd)}`;
    if (isScalar(o.url)) return String(o.url);
  }
  return null;
}

function identOf(obj: Record<string, unknown>): {
  name: string | null;
  permalink: string | null;
  def: string;
} {
  const ident =
    obj.identifier && typeof obj.identifier === "object"
      ? (obj.identifier as Record<string, unknown>)
      : null;
  const permalink = scalarText(ident?.permalink, obj.permalink);
  const name = scalarText(ident?.value, ident?.name, obj.name);
  const def = scalarText(ident?.entity_def_id, obj.entity_def_id);
  return { name: name || null, permalink: permalink || null, def };
}

function locationsOf(obj: Record<string, unknown>): {
  headquarters: string | null;
  country: string | null;
} {
  const ids = obj.location_identifiers ?? obj.locations ?? obj.location;
  if (!Array.isArray(ids)) {
    const hq = asText(obj.headquarters) ?? asText(obj.location);
    return { headquarters: hq, country: countryFromHq(hq) };
  }
  const values: string[] = [];
  let country: string | null = null;
  for (const item of ids) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const value = asText(rec);
    const type = String(rec.location_type ?? rec.type ?? "").toLowerCase();
    if (value) values.push(value);
    if (type === "country" && value)
      country = COUNTRY_ALIASES[value.toLowerCase()] ?? value;
  }
  const headquarters = values.length ? values.join(", ") : null;
  if (!country) country = countryFromHq(headquarters);
  return { headquarters, country };
}

function industriesOf(obj: Record<string, unknown>): string | null {
  const cats =
    obj.categories ?? obj.category_list ?? obj.industries ?? obj.industry;
  if (Array.isArray(cats)) {
    const names = cats
      .map((c) => asText(c))
      .filter((s): s is string => Boolean(s));
    return names.length ? names.slice(0, 4).join("; ") : null;
  }
  return asText(cats);
}

function fundingOf(obj: Record<string, unknown>): string | null {
  const total = obj.funding_total ?? obj.total_funding_usd ?? obj.funding;
  const text = asText(total);
  if (text) return text;
  if (total && typeof total === "object") {
    const rec = total as Record<string, unknown>;
    if (rec.value_usd != null) return `$${String(rec.value_usd)}`;
  }
  return null;
}

function rowFromEntity(obj: Record<string, unknown>): ExtractedRow | null {
  const props =
    obj.properties && typeof obj.properties === "object"
      ? (obj.properties as Record<string, unknown>)
      : obj;
  const { name, permalink, def } = identOf({ ...props, ...obj });
  const defOk =
    !def ||
    def === "organization" ||
    def.includes("organization") ||
    def === "organization.company";
  if (!permalink || !name || !defOk) return null;
  if (["discover", "search", "lists"].includes(permalink.toLowerCase()))
    return null;
  const loc = locationsOf(props);
  const website =
    asText(props.website) ?? asText(props.domain) ?? asText(props.website_url);
  return {
    name,
    permalink,
    url: companyUrlFromPermalink(permalink, null),
    domain: website,
    country: loc.country,
    headquarters: loc.headquarters,
    headcount:
      asText(props.num_employees_enum) ??
      asText(props.num_employees) ??
      asText(props.headcount),
    industry: industriesOf(props),
    funding: fundingOf(props),
  };
}

function collectFromJson(
  node: unknown,
  out: ExtractedRow[],
  seen: Set<string>,
  depth = 0,
): void {
  if (depth > 12 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectFromJson(item, out, seen, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const row = rowFromEntity(obj);
  if (row?.permalink) {
    const key = row.permalink.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && key !== "identifier") {
      collectFromJson(value, out, seen, depth + 1);
    }
  }
}

function isLikelySearchApi(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isCrunchbaseHost(parsed.hostname)) return false;
    const u = `${parsed.pathname}${parsed.search}`.toLowerCase();
    return (
      u.includes("/v4/data/searches") ||
      u.includes("organization.companies") ||
      u.includes("/searches/") ||
      (u.includes("/v4/") &&
        (u.includes("search") ||
          u.includes("collection") ||
          u.includes("lists")))
    );
  } catch {
    return false;
  }
}

type ApiKillBox = { error: KillSwitchError | null };

function attachSearchSniffer(
  page: Page,
  bucket: ExtractedRow[],
  apiKill: ApiKillBox,
): () => void {
  const seen = new Set<string>();
  const onResponse = async (response: Response): Promise<void> => {
    const url = response.url();
    if (!isLikelySearchApi(url)) return;
    if (response.status() === 401 || response.status() === 403) {
      apiKill.error = new KillSwitchError(
        "blocked",
        `KILL SWITCH: search API returned ${response.status()} at ${url}. Stopping now.`,
      );
      return;
    }
    if (!response.ok()) return;
    const ctype = (response.headers()["content-type"] ?? "").toLowerCase();
    const isListsEndpoint = url.toLowerCase().includes("/v4/data/lists/");
    if (!ctype.includes("json") && !isListsEndpoint) return;
    try {
      const text = await response.text();
      if (!text) {
        console.log(
          `  sniffer empty body ${response.status()} ${ctype || "(no ctype)"} ${url}`,
        );
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.log(
          `  sniffer non-JSON ${text.length}b ${ctype || "(no ctype)"} ${url}`,
        );
        return;
      }
      const before = bucket.length;
      collectFromJson(parsed, bucket, seen);
      console.log(
        `  sniffer +${bucket.length - before} rows (${text.length}b, ${ctype || "no-ctype"}) ${url}`,
      );
    } catch {
      /* ignore bodies we cannot read */
    }
  };
  page.on("response", onResponse);
  return () => page.off("response", onResponse);
}

type DomExtractResult = {
  rows: ExtractedRow[];
  emptyState: boolean;
  hasResultChrome: boolean;
};

async function extractFromDom(page: Page): Promise<DomExtractResult> {
  const extractJs = await readFile(
    new URL("./crunchbase-dom-extract.js", import.meta.url),
    "utf8",
  );
  return page.evaluate(extractJs) as Promise<DomExtractResult>;
}

async function clickNextPage(page: Page): Promise<boolean> {
  const selectors = [
    'button[aria-label="Next"]',
    'button[aria-label="Next page"]',
    'a[aria-label="Next"]',
    'a[rel="next"]',
    'button:has-text("Next")',
    'a:has-text("Next")',
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
      enabled = false;
    }
    let visible = false;
    try {
      visible = await loc.isVisible();
    } catch (err) {
      console.log(`  next probe ${sel} isVisible threw: ${String(err)}`);
      visible = false;
    }
    let disabled: string | null = null;
    try {
      disabled = await loc.getAttribute("disabled");
    } catch (err) {
      console.log(`  next probe ${sel} disabled attr threw: ${String(err)}`);
    }
    let ariaDisabled: string | null = null;
    try {
      ariaDisabled = await loc.getAttribute("aria-disabled");
    } catch (err) {
      console.log(`  next probe ${sel} aria-disabled threw: ${String(err)}`);
    }
    console.log(
      `  next probe ${sel} enabled=${enabled} visible=${visible} disabled=${disabled} aria-disabled=${ariaDisabled}`,
    );
    if (!enabled || !visible) continue;
    if (disabled !== null || ariaDisabled === "true") continue;
    await loc.click({ timeout: 5000 });
    console.log(`  next probe clicked ${sel}`);
    return true;
  }
  console.log("  next probe: no clickable Next after all selectors");
  return false;
}

async function scrollGridToEnd(page: Page): Promise<void> {
  const lastOrg = page.locator('a[href*="/organization/"]').last();
  if ((await lastOrg.count()) > 0) {
    await lastOrg.scrollIntoViewIfNeeded().catch((err) => {
      console.log(`  scroll last-row threw: ${String(err)}`);
    });
  }
  await page.mouse.wheel(0, 2400);
}

async function writeOutput(records: CrunchbaseRawCompany[]): Promise<string> {
  const outPath = path.join(REPO_ROOT, OUTPUT_REL);
  await mkdir(path.dirname(outPath), { recursive: true });
  const payload = `${JSON.stringify(records, null, 2)}\n`;
  await writeFile(outPath, payload, "utf8");
  return outPath;
}

async function scrape(): Promise<void> {
  const storageState = await resolveStorageStatePath();
  const searchUrl = await resolveSearchUrl();
  const headed =
    process.env.CRUNCHBASE_HEADED === "1" || process.env.HEADED === "1";

  console.log(
    `Crunchbase scraper starting. max=${MAX_COMPANIES} rate=${RATE_LIMIT_MS}ms`,
  );
  console.log(`Search: ${searchUrl}`);
  console.log(`Session: ${STORAGE_STATE_FILE}`);

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    storageState,
    viewport: VIEWPORT,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);

  const apiRows: ExtractedRow[] = [];
  const apiKill: ApiKillBox = { error: null };
  const detach = attachSearchSniffer(page, apiRows, apiKill);
  const capturedAt = nowIso();
  const merged = new Map<string, CrunchbaseRawCompany>();

  const ingest = (rows: ExtractedRow[], label: string): number => {
    let added = 0;
    for (const row of rows) {
      const rec = toRecord(row, capturedAt);
      if (!rec) {
        console.warn(
          `  skip unparsable row: ${row.name || row.permalink || row.url || "(unknown)"}`,
        );
        continue;
      }
      const key = rec.url.toLowerCase();
      if (merged.has(key)) continue;
      if (merged.size >= MAX_COMPANIES) return added;
      merged.set(key, rec);
      added += 1;
    }
    if (added) console.log(`  +${added} from ${label} (total ${merged.size})`);
    return added;
  };

  try {
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForTimeout(1500);
    if (apiKill.error) throw apiKill.error;
    await assertPageSafe(page);

    let scrollPass = 0;
    while (merged.size < MAX_COMPANIES) {
      if (apiKill.error) throw apiKill.error;
      await assertPageSafe(page);
      await page.waitForTimeout(800);

      ingest(apiRows, "api");
      apiRows.length = 0;

      if (scrollPass === 0) {
        const dom = await extractFromDom(page);
        ingest(dom.rows, "dom");
        if (merged.size === 0 && !dom.emptyState) {
          throw new KillSwitchError(
            "layout_break",
            `KILL SWITCH: zero companies extracted from a results page. URL: ${page.url()}. Stopping now.`,
          );
        }
        if (dom.emptyState && merged.size === 0) {
          console.log(
            "Search returned an empty result set. Writing empty output.",
          );
          break;
        }
        const advancedLocked =
          (await page
            .locator("text=Upgrade")
            .first()
            .isVisible()
            .catch(() => false)) &&
          (await page
            .locator("text=Advanced Search")
            .first()
            .isVisible()
            .catch(() => false)) &&
          merged.size === 0;
        if (advancedLocked) {
          throw new KillSwitchError(
            "blocked",
            "KILL SWITCH: Advanced Search looks locked (no rows). Stopping. Do not fill payment.",
          );
        }
      }

      if (merged.size >= MAX_COMPANIES) {
        console.log(`Hit cap of ${MAX_COMPANIES}.`);
        break;
      }

      const before = merged.size;
      const moved = await clickNextPage(page);
      if (!moved) {
        console.log(`No Next click. Stopping at ${merged.size}.`);
        break;
      }
      console.log(
        `Clicked Next. URL now ${page.url()}. Waiting ${RATE_LIMIT_MS}ms for the list POST.`,
      );
      await sleep(RATE_LIMIT_MS);
      if (apiKill.error) throw apiKill.error;
      ingest(apiRows, "api");
      apiRows.length = 0;
      scrollPass += 1;

      if (merged.size === before) {
        console.log(
          `Next brought no new entities. Stopping at ${merged.size}.`,
        );
        break;
      }
      if (Number.isFinite(MAX_PAGES) && scrollPass >= MAX_PAGES) {
        console.log(
          `Stopping after ${scrollPass} page(s) (CRUNCHBASE_MAX_PAGES).`,
        );
        break;
      }
    }

    const records = [...merged.values()].slice(0, MAX_COMPANIES);
    const n = records.length;
    const nullPct = (
      key: "domain" | "country" | "headcount" | "industry",
    ): number => {
      if (n === 0) return 100;
      const empty = records.filter(
        (r) => r[key] == null || r[key] === "",
      ).length;
      return Math.round((empty / n) * 100);
    };
    const rates = {
      domain: nullPct("domain"),
      country: nullPct("country"),
      headcount: nullPct("headcount"),
      industry: nullPct("industry"),
    };
    console.log(
      `null rates domain=${rates.domain}% country=${rates.country}% headcount=${rates.headcount}% industry=${rates.industry}% (n=${n})`,
    );
    const majorityNull =
      [rates.domain, rates.country, rates.headcount, rates.industry].filter(
        (p) => p > 50,
      ).length >= 3;
    if (n > 0 && majorityNull) {
      throw new KillSwitchError(
        "layout_break",
        `KILL SWITCH: majority of rows have null domain/country/headcount/industry (${rates.domain}/${rates.country}/${rates.headcount}/${rates.industry}%). Not writing. Stopping now.`,
      );
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
