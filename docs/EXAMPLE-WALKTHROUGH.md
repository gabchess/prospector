# Example walkthrough

One full fictional dry run, narrated. FIXTURE throughout: the only input is
`data/sample-companies.csv`, three made-up companies with `.example` domains.
No customer story, no outcome claim.

## The ask

"Find me 20 leads that match my ICP." Fresh clone, no keys, no Clay seat. The
honest first move is the dry run.

## Commands

```bash
pnpm install --frozen-lockfile
npx playwright install chromium
pnpm test
cp data/sample-companies.csv data/companies.csv
pnpm agent
```

`pnpm test`: 42 green. The gates in `src/icp.ts` parse, so the ICP is at
least well-formed before anything reads data.

## Input

| company | domain | country | headcount | type |
|---|---|---|---|---|
| Acme Outbound Co | acmeoutbound.example | US | 25 | lead_gen_agency |
| Harbor Growth Ltd | harborgrowth.example | UK | 40 | digital_marketing_agency |
| Beacon Sales Partners | beaconsales.example | CA | 15 | sales_consulting |

All three sit inside the ICP shape: countries in the enum, headcount inside
11-200, categories in `CompanyTypeSchema`. The raw band was "10 - 49", so
normalize took the low edge and flagged `headcount_ambiguous=true` on each.
No invented midpoints.

## Gate decisions

`pnpm agent` starts the MCP server, reads the three rows through
`scrape_clutch` (the tool reads the normalized CSV; it does not open a
browser), and scores each via `score_lead`:

- Country gate: pass, all three.
- Company type gate: pass, all three.
- Headcount gate: pass, all three, ambiguity flag traveling along.
- VP of Sales blocker: fires on all three. No Clay enrichment ran, so no
  decision-maker titles exist, and "no VP of Sales found (hard disqualifier
  in the ICP)" is honest, not a bug.
- Signal blocker: fires on all three. No Apify pass ran, so "no intent
  signal in the window" is honest too.

Score: below the 40-point floor for every row. Auto-rejected with reasons.

## The approval stop

The agent prints: "Scored 3. 3 auto rejected below 40." then "Nothing reached
the approval gate." `data/pending-approval.json` is not even written; there
is nothing for a human to walk. Zero leads marked qualified, which is the
correct outcome for zero verified evidence.

## Reading the trace

`data/agent-log.jsonl` holds every step: the MCP connect, each perceive
call, each drop/score decision, and a final `batch_summary` with
`auto_rejected: 3, pending: 0, threshold: 40`. The run is inspectable after
the fact; nothing happened off the record.

## What this proved

The server, the gates, the scoring, the logging, and the empty-gate approval
stop all work on a fresh clone with no keys and no seats. What it did not
prove: that your ICP finds leads, that Clutch returns rows today, or anything
about Clay. Those need the real run: onboard your ICP, add `APIFY_TOKEN`,
configure Clay in your host, and follow
[OPERATE-PROSPECTOR.md](OPERATE-PROSPECTOR.md).
