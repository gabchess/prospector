---
name: onboard
description: Set up a fresh fork of Prospector, the lead pipeline, for your own ICP. Walks you through editing the ICP gates, adding your keys, and running the pipeline in order. Use on first clone, or whenever the target customer profile changes.
---

# /onboard - point Prospector at YOUR customers

This pipeline shipped one proven run for one ICP. Yours is different. Three steps make it yours,
about 15 minutes.

## Step 1 - your ICP goes in the gates (5 min)

Open `src/icp.ts`. Everything the pipeline accepts or rejects lives in the zod schemas:

- `CompanyTypeSchema` - the company categories you sell to
- `CountrySchema` - your geographies
- `CompanySchema` headcount `.min()` / `.max()` - your size band
- `DecisionMakerTitleSchema` - who counts as a buyer for you

Edit the enum values and bounds. Then run `pnpm test`: the suite parses every gate, so
a typo fails loudly here instead of silently at 2am mid-scrape.

The gates DISQUALIFY, they never score. Dead site, generic info@ inbox, nobody who owns
sales: a row that trips one is out, and the row says which gate killed it. Keep that
property when you add gates. A binary gate can be debugged; a weighted score cannot.

## Step 2 - your keys (5 min)

Copy `.env.example` to `.env` and fill in:

- `APIFY_TOKEN` - powers the LinkedIn signal pass. A run costs about $4 in Apify credit.

Two integrations have no key to paste:

- **Crunchbase** needs a logged-in browser state, not an API key. Log into a trial
  account once, save the session as `.crunchbase.storageState.json` (see the scraper
  header comment). Skipping Crunchbase is fine: Clutch produced 71 of the original run's 100 rows.
- **Clay** runs through its own MCP server, configured in your Claude/host settings,
  not in this repo. Without it you still get scraped + filtered companies; you lose
  the contact-enrichment columns.

## Step 3 - run in order (5 min to first output)

```bash
pnpm install && npx playwright install chromium
pnpm test              # 42 tests green before you trust anything
pnpm scrape:clutch
pnpm scrape:crunchbase # optional, needs the storage state
pnpm normalize         # merge, dedupe, gate -> data/companies.csv
pnpm agent             # scores each company, stops at YOUR approval
```

`pnpm mcp` exposes the whole pipeline as an MCP server so an agent can drive it.

## What this skill never does

Send email, buy data, bypass a login wall, or mark a lead qualified without a human
approving it. The human gate in `src/agent/qualify.ts` is the product, not a demo step.

**Next step:** edit `src/icp.ts`, run `pnpm test`, and scrape.
