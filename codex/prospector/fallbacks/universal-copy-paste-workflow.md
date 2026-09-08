# Universal copy-paste workflow

Use this when no agent host has the skill loaded, or the host cannot read the
repo. Everything below runs on a plain terminal with node and pnpm; any chat
assistant can interpret the output when you paste it.

## The commands, in order

```bash
git clone https://github.com/gabchess/prospector
cd prospector
pnpm install --frozen-lockfile
npx playwright install chromium
pnpm test                                  # must be green before anything else

# your ICP: edit src/icp.ts, then re-run pnpm test

cp .env.example .env                       # add APIFY_TOKEN if you have one
pnpm scrape:clutch
pnpm scrape:crunchbase                     # optional, needs saved login state
pnpm normalize                             # writes data/companies.csv
# Clay enrichment happens in Clay, exported as CSV (see knowledge/clay-integration.md)
pnpm finalize path/to/clay-export.csv      # writes data/leads_final.csv
pnpm agent                                 # scores, stops at the approval gate
pnpm agent --approve                       # walk pending leads one by one
```

## What to paste into any chat host

Paste these, one at a time, and ask "interpret this gate output, tell me what
was rejected and by which gate":

- The tail of `pnpm test` output.
- The per-field null-rate lines the Clutch scraper prints.
- The summary block `pnpm finalize` prints: qualified count, dropped for
  non-sales title, shipped, shipped by source, tier counts, email status
  counts.
- The contents of `data/pending-approval.json` before you walk the approval.
- Any `KillSwitchError` message, verbatim.

## What the chat host may and may not do with it

May: explain which gate fired, summarize counts, help you read a blocker
list, help you draft the next ICP edit.

May not: mark leads qualified (that is `pnpm agent --approve`, your hands),
invent enrichment data to fill gaps, tell you to retry past a kill switch, or
relabel an email status.

## Dry run without anything real

```bash
cp data/sample-companies.csv data/companies.csv
pnpm agent
```

Three fictional rows, all auto-rejected for missing enrichment and signals,
approval gate empty. That output means the machine works; see
`examples/dry-run-gates.md`.
