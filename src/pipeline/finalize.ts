/**
 * Final assembly.
 *
 * Joins the Clay output (decision maker + email) back onto the signal file
 * (intent evidence + provenance), runs a real DNS MX check on every email
 * domain, ranks by tier, and writes the top N to data/leads_final.csv.
 *
 * On email_status, deliberately: Clay's MCP surface returns the address
 * without the waterfall's validation column, so nothing here can honestly
 * claim SMTP-verified. This step checks what it can actually check, which is
 * syntax, a live MX record and role-account shape, and labels the result for
 * exactly that. Claiming "valid" on an unverified address would be the one
 * lie that matters in a lead deliverable.
 *
 *   pnpm finalize path/to/clay-export.csv [limit]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMx } from "node:dns/promises";
import { LeadSchema } from "../icp.js";
import { readCsv, toCsvField } from "./csv.js";
import { ownsSales } from "./salesOwner.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const SIGNALS_PATH = path.join(REPO_ROOT, "data", "companies_signals.csv");
const OUT_PATH = path.join(REPO_ROOT, "data", "leads_final.csv");
const DEFAULT_LIMIT = 100;

const TIER_ORDER: Record<string, number> = { tier_1: 0, tier_2: 1, tier_3: 2 };

/** Mailboxes that reach a shared inbox, not a person. Kept as a label rather
 * than a filter: the reviewer decides whether they are acceptable. */
const ROLE_LOCAL_PARTS = new Set([
  "info",
  "hello",
  "contact",
  "sales",
  "support",
  "admin",
  "team",
  "office",
  "help",
]);

const mxCache = new Map<string, boolean>();

async function hasMx(domain: string): Promise<boolean> {
  const key = domain.toLowerCase();
  const cached = mxCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const records = await resolveMx(key);
    const ok = records.length > 0;
    mxCache.set(key, ok);
    return ok;
  } catch {
    mxCache.set(key, false);
    return false;
  }
}

/** Honest status. Never returns "valid": nothing in this pipeline performed an
 * SMTP handshake, so nothing here is entitled to that word. */
async function classifyEmail(email: string): Promise<string> {
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return "invalid_format";
  const [local, domain] = email.toLowerCase().split("@") as [string, string];
  if (!(await hasMx(domain))) return "no_mx";
  return ROLE_LOCAL_PARTS.has(local) ? "mx_ok_role_account" : "mx_ok";
}

async function readCsvIfPresent(
  file: string,
): Promise<Array<Record<string, string>>> {
  try {
    return await readCsv(file);
  } catch {
    return [];
  }
}

function resolveCapturedAt(
  existing: Record<string, string> | undefined,
  clay: Record<string, string>,
  signal: Record<string, string>,
): string {
  // Empty is more honest than stamping now.
  return existing?.captured_at || clay.captured_at || signal.captured_at || "";
}

async function main(): Promise<void> {
  const [clayArgRaw, limitArg] = process.argv.slice(2);
  if (!clayArgRaw) {
    throw new Error(
      "Missing required argument: Clay export CSV path. Usage: pnpm finalize path/to/clay-export.csv",
    );
  }
  const clayPath = path.resolve(clayArgRaw);
  const limit = Number(limitArg) > 0 ? Number(limitArg) : DEFAULT_LIMIT;

  const clayRows = await readCsv(clayPath);
  const signalRows = await readCsv(SIGNALS_PATH);
  const existingRows = await readCsvIfPresent(OUT_PATH);
  const byDomain = new Map(
    signalRows.filter((r) => r.domain).map((r) => [r.domain!.toLowerCase(), r]),
  );
  const existingByDomain = new Map(
    existingRows
      .filter((r) => r.domain)
      .map((r) => [r.domain!.toLowerCase(), r]),
  );

  console.log(
    `Clay rows: ${clayRows.length}. Signal rows with a domain: ${byDomain.size}.`,
  );

  const enriched: Array<Record<string, string>> = [];
  for (const row of clayRows) {
    const domainKey = (row.domain ?? "").toLowerCase();
    const signal = byDomain.get(domainKey) ?? {};
    const existing = existingByDomain.get(domainKey);
    const emailStatus = await classifyEmail(row.email ?? "");
    const hiring = signal.hiring_signal ?? "";
    const post = signal.post_signal ?? "";
    const hasHiring =
      Boolean(hiring) && hiring !== "no verifiable signal found";
    const hasPost = Boolean(post) && post !== "no verifiable signal found";
    enriched.push({
      company: row.name ?? "",
      domain: row.domain ?? "",
      country: row.country ?? signal.country ?? "",
      headcount: row.headcount_raw ?? signal.headcount_raw ?? "",
      company_type: signal.company_type ?? "",
      decision_maker_name: row.dm_name ?? "",
      decision_maker_title: row.dm_title ?? "",
      decision_maker_linkedin: row.dm_linkedin ?? "",
      sales_owner_title: row.dm_title ?? "",
      email: row.email ?? "",
      email_status: emailStatus,
      signal_tier: row.signal_tier || "tier_3",
      signal_type:
        hasHiring && hasPost
          ? "both"
          : hasHiring
            ? "hiring"
            : hasPost
              ? "post"
              : "none",
      signal_evidence: hasHiring
        ? hiring
        : hasPost
          ? post
          : "no verifiable signal found",
      signal_url: signal.signal_url ?? "",
      source: signal.source ?? "",
      origin_url: signal.origin_url ?? "",
      captured_at: resolveCapturedAt(existing, row, signal),
    });
  }

  enriched.sort((a, b) => {
    const tierDelta =
      (TIER_ORDER[a.signal_tier] ?? 9) - (TIER_ORDER[b.signal_tier] ?? 9);
    if (tierDelta !== 0) return tierDelta;
    const statusRank = (s: string) =>
      s === "mx_ok" ? 0 : s === "mx_ok_role_account" ? 1 : 2;
    const statusDelta = statusRank(a.email_status) - statusRank(b.email_status);
    if (statusDelta !== 0) return statusDelta;
    return a.company.localeCompare(b.company);
  });

  // The sales-owner rule the README states has to hold on every shipped row,
  // not just on the ones a reviewer happens to open.
  const eligible = enriched.filter((r) => ownsSales(r.sales_owner_title));
  const droppedForTitle = enriched.length - eligible.length;
  // Every shipped row has to parse as a Lead. A row that fails here is a bug
  // upstream, and the file is not written around it.
  const shipped = eligible.slice(0, limit).map((r) => LeadSchema.parse(r));
  const header = Object.keys(shipped[0] ?? {});
  const csv = [
    header.join(","),
    ...shipped.map((r) =>
      header.map((k) => toCsvField(r[k as keyof typeof r])).join(","),
    ),
  ].join("\n");
  await writeFile(OUT_PATH, `${csv}\n`, "utf8");

  const count = (pred: (r: (typeof enriched)[number]) => boolean) =>
    enriched.filter(pred).length;
  console.log(
    `\nQualified: ${enriched.length}. Dropped for a non-sales title: ${droppedForTitle}. Shipped: ${shipped.length}. -> ${OUT_PATH}`,
  );
  const bySource = shipped.reduce<Record<string, number>>((acc, r) => {
    const key = r.source || "(none)";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Shipped by source: ${JSON.stringify(bySource)}`);
  console.log("\nAll qualified rows:");
  for (const tier of ["tier_1", "tier_2", "tier_3"]) {
    console.log(`  ${tier}: ${count((r) => r.signal_tier === tier)}`);
  }
  console.log("\nEmail status across qualified rows:");
  for (const s of ["mx_ok", "mx_ok_role_account", "no_mx", "invalid_format"]) {
    console.log(`  ${s}: ${count((r) => r.email_status === s)}`);
  }
  console.log("\nShipped set:");
  for (const tier of ["tier_1", "tier_2", "tier_3"]) {
    console.log(
      `  ${tier}: ${shipped.filter((r) => r.signal_tier === tier).length}`,
    );
  }
  console.log(
    `  with a signal URL: ${shipped.filter((r) => r.signal_url).length}`,
  );
  console.log(
    `  mx_ok: ${shipped.filter((r) => r.email_status === "mx_ok").length}`,
  );
}

main().catch((err: unknown) => {
  console.error(
    err instanceof Error ? (err.stack ?? err.message) : String(err),
  );
  process.exit(1);
});
