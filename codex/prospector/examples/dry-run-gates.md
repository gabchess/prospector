# Example: the dry run, gate by gate

FIXTURE. Every row below comes from `data/sample-companies.csv` in the engine
repo. All three companies are fictional; the domains are `.example`. This is
not a customer story and proves no outcome.

## Setup

```bash
cp data/sample-companies.csv data/companies.csv
pnpm agent
```

## What the agent sees

Three fictional rows: Acme Outbound Co (US, 25, lead_gen_agency), Harbor
Growth Ltd (UK, 40, digital_marketing_agency), Beacon Sales Partners (CA, 15,
sales_consulting). All three are in the ICP shape: right countries, headcount
inside 11-200, right categories.

## What the gates say anyway

`score_lead` in `src/scoring.ts` adds hard blockers even for in-ICP rows:

- "no VP of Sales found (hard disqualifier in the ICP)": true for all three,
  because the dry run has no Clay enrichment, so no titles exist.
- "no intent signal in the window": true for all three, because the dry run
  has no Apify pass.

Result: all three score below the 40-point floor, all three are auto-rejected
with their blockers named in `data/agent-log.jsonl`.

## The approval stop

Nothing reaches the approval gate, and the agent prints exactly that:
"Nothing reached the approval gate." No lead is marked qualified. That is the
dry run succeeding: it proves the MCP server responds, the scoring runs, the
blockers are named, and the human gate holds even when the gate is empty.

## What a real run changes

Real scrapes plus real signals can clear the blockers; a real Clay export
supplies titles that can clear `ownsSales`. Leads at or above 40 then wait in
`data/pending-approval.json` for `pnpm agent --approve`.
