/**
 * MCP server for the Prospector lead pipeline.
 *
 * Exposes the pipeline as four tools over stdio so any MCP client can drive
 * qualification. The agent in src/agent/qualify.ts is the first consumer.
 *
 * Honesty note on naming: `scrape_crunchbase` and `scrape_clutch` read the
 * normalized rows in data/companies.csv that the Playwright scrapers and
 * normalize.ts produced. They do not open a browser. Every response carries
 * `normalized_at`, the file's modification time, so the caller can see how
 * old the data is instead of assuming it is live.
 */
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { scoreLead, type ScoreInput } from "../scoring.js";
import { CompanyTypeSchema, CountrySchema } from "../icp.js";
import { readCsv } from "../pipeline/csv.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const COMPANIES_PATH = path.join(REPO_ROOT, "data", "companies.csv");
const SIGNALS_PATH = path.join(REPO_ROOT, "data", "companies_signals.csv");
const NO_SIGNAL = "no verifiable signal found";

type Table = { rows: Array<Record<string, string>>; modifiedAt: string };

async function readTable(file: string): Promise<Table | null> {
  try {
    const [rows, info] = await Promise.all([readCsv(file), stat(file)]);
    return { rows, modifiedAt: info.mtime.toISOString() };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    // Rewrapped on purpose. A raw fs error carries the absolute path, and this
    // runs as an MCP server whose errors go back to whoever called the tool.
    throw new Error(
      `could not read ${path.basename(file)} (${code ?? "unknown error"})`,
    );
  }
}

function toToolResult(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

const filterShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe("max rows to return"),
  country: CountrySchema.optional().describe("restrict to one ICP country"),
  company_type: CompanyTypeSchema.optional().describe(
    "restrict to one ICP company type",
  ),
  max_headcount: z
    .number()
    .int()
    .optional()
    .describe("drop rows whose low edge exceeds this"),
};

function buildCaptureTool(source: "crunchbase" | "clutch") {
  return async (args: {
    limit: number;
    country?: string;
    company_type?: string;
    max_headcount?: number;
  }) => {
    const table = await readTable(COMPANIES_PATH);
    const rows = table?.rows.filter((row) => row.source === source) ?? [];
    if (!table || rows.length === 0) {
      return toToolResult({
        source,
        available: false,
        note: `data/companies.csv has no ${source} rows yet. Run the ${source} scraper, then pnpm normalize.`,
        companies: [],
      });
    }

    const enriched = rows.map((row) => ({
      name: row.name ?? "",
      domain: row.domain || null,
      country: row.country || null,
      headcount_raw: row.headcount_raw || null,
      headcount_low_edge: row.headcount_low_edge
        ? Number(row.headcount_low_edge)
        : null,
      headcount_ambiguous: row.headcount_ambiguous === "true",
      company_type: row.company_type || null,
      funding_usd: row.funding_usd ? Number(row.funding_usd) : null,
      url: row.origin_url ?? "",
    }));

    const filtered = enriched.filter((row) => {
      if (args.country && row.country !== args.country) return false;
      if (args.company_type && row.company_type !== args.company_type)
        return false;
      if (args.max_headcount != null) {
        if (row.headcount_low_edge == null) return false;
        if (row.headcount_low_edge > args.max_headcount) return false;
      }
      return true;
    });

    return toToolResult({
      source,
      available: true,
      total_captured: rows.length,
      matched: filtered.length,
      returned: Math.min(filtered.length, args.limit),
      normalized_at: table.modifiedAt,
      companies: filtered.slice(0, args.limit),
    });
  };
}

const server = new McpServer({ name: "prospector", version: "0.1.0" });

server.registerTool(
  "scrape_crunchbase",
  {
    title: "Read the Crunchbase capture",
    description:
      "Returns companies captured from the Crunchbase saved search, with optional ICP filters. Reads the crunchbase rows of data/companies.csv, the normalized output of the Playwright scraper. Does not open a browser.",
    inputSchema: filterShape,
  },
  buildCaptureTool("crunchbase"),
);

server.registerTool(
  "scrape_clutch",
  {
    title: "Read the Clutch capture",
    description:
      "Returns companies captured from Clutch.co directory listings, with optional ICP filters. Reads the clutch rows of data/companies.csv. Reports available:false when there are none yet, instead of an empty list that would look like a real zero result.",
    inputSchema: filterShape,
  },
  buildCaptureTool("clutch"),
);

server.registerTool(
  "check_signals",
  {
    title: "Look up intent signals for a domain",
    description:
      "Returns the hiring signal and the post signal for one company domain, from data/companies_signals.csv. Returns known:false when the domain has not been checked, which is different from a company that was checked and has no signal.",
    inputSchema: {
      domain: z
        .string()
        .min(3)
        .describe("company domain, lowercase, no www and no protocol"),
    },
  },
  async ({ domain }: { domain: string }) => {
    const table = await readTable(SIGNALS_PATH);
    if (!table) {
      return toToolResult({
        domain,
        known: false,
        note: "data/companies_signals.csv does not exist yet. Run the intent signal step first.",
      });
    }

    const wanted = domain.toLowerCase().replace(/^www\./, "");
    const hit = table.rows.find(
      (row) => (row.domain ?? "").toLowerCase() === wanted,
    );
    if (!hit) {
      return toToolResult({
        domain: wanted,
        known: false,
        note: "domain not checked yet",
      });
    }
    const hasSignal = (text: string | undefined): boolean =>
      Boolean(text) && text !== NO_SIGNAL;
    const hiring = hasSignal(hit.hiring_signal);
    const post = hasSignal(hit.post_signal);
    return toToolResult({
      domain: wanted,
      known: true,
      hiring_signal: hiring,
      post_signal: post,
      signal_url: hit.signal_url || null,
      signal_type:
        hiring && post ? "both" : hiring ? "hiring" : post ? "post" : "none",
      checked_at: table.modifiedAt,
    });
  },
);

server.registerTool(
  "score_lead",
  {
    title: "Score one lead against the ICP",
    description:
      "Scores a single candidate 0 to 100 against the ICP and returns the reasons and the blockers behind the number. A lead carrying any blocker is never qualified, whatever the score says. This is the tool that makes the decision auditable.",
    inputSchema: {
      name: z.string().min(1),
      domain: z.string().min(3),
      country: z
        .string()
        .describe("two letter country, expects US, UK, CA or AU"),
      headcount: z.number().int().describe("integer headcount, not a band"),
      company_type: z.string().describe("one of the four ICP company types"),
      hiring_signal: z.boolean().default(false),
      post_signal: z.boolean().default(false),
      signal_url: z.string().optional(),
      decision_maker_title: z.string().optional(),
      has_vp_sales: z.boolean().default(false),
      email_status: z
        .string()
        .optional()
        .describe("valid, risky, invalid or unknown"),
    },
  },
  async (args: Record<string, unknown>) => {
    const input: ScoreInput = {
      company: {
        name: args.name as string,
        domain: args.domain as string,
        country: args.country as never,
        headcount: args.headcount as number,
        company_type: args.company_type as never,
      },
      signals: {
        hiring_signal: args.hiring_signal === true,
        post_signal: args.post_signal === true,
        signal_url: args.signal_url as string | undefined,
      },
      decision_maker_title:
        (args.decision_maker_title as string | undefined) ?? null,
      has_vp_sales: args.has_vp_sales === true,
      email_status: (args.email_status as string | undefined) ?? null,
    };
    const result = scoreLead(input);
    return toToolResult({ name: args.name, domain: args.domain, ...result });
  },
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  // stderr on purpose: stdout carries the MCP wire protocol and must stay clean.
  console.error("prospector MCP server ready on stdio (4 tools)");
}

main().catch((err: unknown) => {
  console.error(
    err instanceof Error ? (err.stack ?? err.message) : String(err),
  );
  process.exit(1);
});
