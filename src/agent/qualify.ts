/**
 * Qualification agent.
 *
 * A ReAct loop over the MCP server in src/mcp/server.ts. The agent spawns that
 * server as a subprocess and talks to it over stdio, so running this file is
 * itself the proof that the MCP server is consumed and not merely present.
 *
 * The loop is perceive, reason, act, feedback:
 *   perceive  fetch candidate companies through the capture tools
 *   reason    decide what is missing for each candidate and what to ask next
 *   act       call check_signals, then score_lead
 *   feedback  append every step to data/agent-log.jsonl, then stop at the
 *             approval gate. Nothing is ever marked qualified without a human.
 *
 * Usage:
 *   pnpm agent                 score a sample and stop at the approval gate
 *   pnpm agent --limit 50      widen the sample
 *   pnpm agent --approve       walk the pending leads one by one
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const LOG_PATH = path.join(REPO_ROOT, "data", "agent-log.jsonl");
const PENDING_PATH = path.join(REPO_ROOT, "data", "pending-approval.json");
const SERVER_ENTRY = path.join(REPO_ROOT, "src", "mcp", "server.ts");

/** Leads at or above this score reach the human. Below it the agent rejects on
 * its own, because a blocked lead cannot become qualified by approval anyway. */
const APPROVAL_THRESHOLD = 40;

type Candidate = {
  name: string;
  domain: string | null;
  country: string | null;
  headcount_low_edge: number | null;
  headcount_ambiguous: boolean;
  company_type: string | null;
  url: string;
};

type Scored = {
  name: string;
  domain: string;
  url: string;
  score: number;
  qualified: boolean;
  reasons: string[];
  blockers: string[];
  headcount_ambiguous: boolean;
};

let stepCounter = 0;

async function logStep(entry: Record<string, unknown>): Promise<void> {
  stepCounter += 1;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    step: stepCounter,
    ...entry,
  });
  await appendFile(LOG_PATH, `${line}\n`, "utf8");
}

function parseArgs(argv: string[]): { limit: number; approve: boolean } {
  const limitIndex = argv.indexOf("--limit");
  const raw = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : NaN;
  return {
    limit: Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20,
    approve: argv.includes("--approve"),
  };
}

/** Every tool result comes back as a JSON string inside a text content block. */
function unwrap(result: unknown): Record<string, unknown> {
  const content = (
    result as { content?: Array<{ type: string; text?: string }> }
  ).content;
  const first = content?.find((c) => c.type === "text");
  if (!first?.text) throw new Error("tool returned no text content");
  return JSON.parse(first.text) as Record<string, unknown>;
}

async function perceive(client: Client, limit: number): Promise<Candidate[]> {
  const collected: Candidate[] = [];
  // Clutch first: it is the primary source, Crunchbase supplements it.
  for (const tool of ["scrape_clutch", "scrape_crunchbase"]) {
    const raw = await client.callTool({
      name: tool,
      arguments: { limit: limit * 3, max_headcount: 200 },
    });
    const payload = unwrap(raw);
    await logStep({
      phase: "perceive",
      tool,
      input: { limit: limit * 3, max_headcount: 200 },
      output_summary: {
        available: payload.available,
        total_captured: payload.total_captured ?? 0,
        matched: payload.matched ?? 0,
      },
    });
    if (payload.available !== true) continue;
    collected.push(...((payload.companies as Candidate[]) ?? []));
    if (collected.length >= limit) break;
  }
  return collected.slice(0, limit);
}

async function actOnCandidate(
  client: Client,
  candidate: Candidate,
): Promise<Scored | null> {
  // Reason: a candidate with no domain cannot be signal checked or emailed, so
  // it is dropped before spending a tool call on it.
  if (!candidate.domain) {
    await logStep({
      phase: "reason",
      company: candidate.name,
      decision: "drop",
      why: "no domain, cannot check signals or verify an email",
    });
    return null;
  }

  const signals = unwrap(
    await client.callTool({
      name: "check_signals",
      arguments: { domain: candidate.domain },
    }),
  );
  await logStep({
    phase: "act",
    tool: "check_signals",
    input: { domain: candidate.domain },
    output_summary: {
      known: signals.known,
      signal_type: signals.signal_type ?? "unknown",
    },
  });

  const scored = unwrap(
    await client.callTool({
      name: "score_lead",
      arguments: {
        name: candidate.name,
        domain: candidate.domain,
        country: candidate.country ?? "??",
        headcount: candidate.headcount_low_edge ?? 0,
        company_type: candidate.company_type ?? "unknown",
        hiring_signal: signals.hiring_signal === true,
        post_signal: signals.post_signal === true,
        // Not known at this stage of the pipeline. Left false on purpose so the
        // blocker shows up in the log instead of being assumed away.
        has_vp_sales: false,
        email_status: "unknown",
      },
    }),
  );
  await logStep({
    phase: "act",
    tool: "score_lead",
    input: { name: candidate.name, domain: candidate.domain },
    output_summary: {
      score: scored.score,
      qualified: scored.qualified,
      blockers: (scored.blockers as string[]).length,
    },
  });

  return {
    name: candidate.name,
    domain: candidate.domain,
    url: candidate.url,
    score: scored.score as number,
    qualified: scored.qualified as boolean,
    reasons: scored.reasons as string[],
    blockers: scored.blockers as string[],
    headcount_ambiguous: candidate.headcount_ambiguous === true,
  };
}

async function approvalGate(
  pending: Scored[],
  walkNow: boolean,
): Promise<void> {
  if (pending.length === 0) {
    console.log("\nNothing reached the approval gate.");
    await logStep({ phase: "feedback", decision: "no_pending", count: 0 });
    return;
  }

  await writeFile(
    PENDING_PATH,
    `${JSON.stringify(pending, null, 2)}\n`,
    "utf8",
  );
  console.log(`\n${pending.length} lead(s) waiting for a human decision.`);
  console.log(`Written to ${path.relative(REPO_ROOT, PENDING_PATH)}`);

  if (!walkNow || !process.stdin.isTTY) {
    console.log("\nApproval gate reached. Nothing was marked qualified.");
    console.log("Review the file, then run: pnpm agent --approve");
    await logStep({
      phase: "feedback",
      decision: "awaiting_human",
      count: pending.length,
      gate: "blocked_on_approval",
    });
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const lead of pending) {
      console.log(`\n${lead.name} (${lead.domain}) scored ${lead.score}`);
      lead.reasons.forEach((r) => console.log(`  + ${r}`));
      lead.blockers.forEach((b) => console.log(`  ! ${b}`));
      const answer = (await rl.question("  approve this lead? [y/N] "))
        .trim()
        .toLowerCase();
      const approved = answer === "y" || answer === "yes";
      await logStep({
        phase: "feedback",
        decision: approved ? "human_approved" : "human_rejected",
        company: lead.name,
        domain: lead.domain,
        score: lead.score,
      });
      console.log(approved ? "  approved" : "  rejected");
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const { limit, approve } = parseArgs(process.argv.slice(2));
  await mkdir(path.dirname(LOG_PATH), { recursive: true });

  const client = new Client({ name: "prospector-qualifier", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", SERVER_ENTRY],
  });

  await client.connect(transport);
  const tools = await client.listTools();
  await logStep({
    phase: "perceive",
    decision: "connected_to_mcp",
    tools: tools.tools.map((t) => t.name),
  });
  console.log(
    `Connected to the MCP server. Tools: ${tools.tools.map((t) => t.name).join(", ")}`,
  );

  try {
    const candidates = await perceive(client, limit);
    console.log(`Perceived ${candidates.length} candidate(s).`);

    const scored: Scored[] = [];
    for (const candidate of candidates) {
      const result = await actOnCandidate(client, candidate);
      if (result) scored.push(result);
    }

    scored.sort((a, b) => b.score - a.score);
    const pending = scored.filter((s) => s.score >= APPROVAL_THRESHOLD);
    const rejected = scored.filter((s) => s.score < APPROVAL_THRESHOLD);

    await logStep({
      phase: "feedback",
      decision: "batch_summary",
      scored: scored.length,
      pending: pending.length,
      auto_rejected: rejected.length,
      threshold: APPROVAL_THRESHOLD,
    });

    console.log(
      `Scored ${scored.length}. ${rejected.length} auto rejected below ${APPROVAL_THRESHOLD}.`,
    );
    await approvalGate(pending, approve);
    console.log(
      `\nFull trace: ${path.relative(REPO_ROOT, LOG_PATH)} (${stepCounter} steps)`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error(
    err instanceof Error ? (err.stack ?? err.message) : String(err),
  );
  process.exit(1);
});
