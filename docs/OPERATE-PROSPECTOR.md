# Operate Prospector

The run order, how to read the gates, and the run log. Assumes the engine is
installed ([INSTALL-CODEX.md](INSTALL-CODEX.md) or
[INSTALL-CLAUDE.md](INSTALL-CLAUDE.md)).

## Run order

```bash
pnpm test                          # gates parse; do this after any src/icp.ts edit
pnpm scrape:clutch                 # primary source
pnpm scrape:crunchbase             # optional; needs .crunchbase.storageState.json
pnpm normalize                     # merge, gate, dedupe -> data/companies.csv
# signals pass (Apify, APIFY_TOKEN in .env) -> data/companies_signals.csv
# Clay enrichment in your host -> export CSV (see codex/prospector/knowledge/clay-integration.md)
pnpm finalize path/to/clay-export.csv   # MX check + sales-owner gate -> data/leads_final.csv
pnpm agent                         # score, stop at the approval gate
pnpm agent --approve               # walk pending leads one by one
```

Stages are independent files, so you can re-run any stage without repeating
earlier ones (see [RECOVERY-AND-EXIT.md](RECOVERY-AND-EXIT.md)).

## Reading the gates

Each stage prints counts. Read them in order:

- **Scrapers:** per-field null-rate lines. High null rates mean the source
  layout changed; the Clutch scraper aborts before writing when rates blow
  up. A `KillSwitchError` message means CAPTCHA, block, or expired login:
  the run is over by design.
- **Normalize:** rows in from each source, rows dropped by geo and headcount
  gates, dedupes, `needs_domain_lookup` flags.
- **Finalize:** Clay rows in, dropped for non-sales title, shipped, tier
  counts, and email status counts (`mx_ok`, `mx_ok_role_account`, `no_mx`,
  `invalid_format`). Every one of those labels means exactly what it says;
  see [VALIDATION-AND-LIMITS.md](VALIDATION-AND-LIMITS.md).
- **Agent:** scored count, auto-rejected below the threshold, pending count.
  Blockers per lead name the gate that fired.

A row is never silently dropped. If you cannot say which gate killed a row,
read `data/agent-log.jsonl`.

## Run log

Fill
[../codex/prospector/references/run-log-template.md](../codex/prospector/references/run-log-template.md)
for every run: run id, ICP version, sources, rows in and out per gate, Apify
spend, Clay columns returned, approvals granted and refused. Counts and gate
names only; never paste real lead rows into a shared log.

## Cadence and cost

A full run costs about $4 in Apify credit plus your Clay seat usage. Scraping
and gating cost nothing. Weekly cadence suits most ICPs; the gates make each
run comparable because the same binary rules apply every time.
