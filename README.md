# Prospector

A B2B outbound lead pipeline you configure to your own ICP: Clutch and Crunchbase
scraping, Apify intent signals, Clay enrichment over MCP, disqualifying gates, and
a human approval step before any lead ships.

## How it works

| Step | Where | What it does |
|---|---|---|
| ICP | `src/icp.ts` | Your customer profile as zod schemas: the company gate and the shape of a shipped lead |
| Scrape 1 | `src/scrapers/clutch.ts` | Playwright over Clutch category listings, with a null-rate check before it writes anything |
| Scrape 2 | `src/scrapers/crunchbase.ts` | Playwright over a logged-in Crunchbase saved search, 2s between requests, stops on CAPTCHA |
| Normalize | `src/pipeline/normalize.ts` | Merges both sources, normalizes domains, applies the geo and headcount gates, dedupes by domain |
| Signals | Apify actors | LinkedIn jobs and posts as the intent signal, needs `APIFY_TOKEN` |
| Enrich | Clay | Decision maker, sales owner, and work email through Clay's MCP server |
| Finalize | `src/pipeline/finalize.ts` | Joins the Clay export, runs the MX check, drops non-sales titles, ranks by tier, validates every row |
| Serve | `src/mcp/server.ts` | Exposes the pipeline as an MCP server with four tools |
| Qualify | `src/agent/qualify.ts` | A ReAct loop that scores each lead against the ICP and stops at a human approval gate |

## Configure it for your company

Everything that makes this pipeline yours lives in three places:

1. **Your ICP, in `src/icp.ts`.** Zod schemas you edit directly: `CountrySchema`
   (geo), the headcount `.min()`/`.max()` on `CompanySchema` (size band),
   `arr_estimate_usd` bounds (revenue ceiling), `CompanyTypeSchema` (service
   categories). The test suite parses every gate, so a typo fails at `pnpm test`,
   not mid-scrape.
2. **Gate thresholds.** The approval score floor lives in `src/agent/qualify.ts`;
   leads below it are auto-rejected, leads at or above it wait for a human.
3. **Your keys.** `APIFY_TOKEN` in `.env` (copy `.env.example`).

What you need:

- An Apify token for the signal step.
- A Clay seat, with Clay's MCP server configured in your agent host. Without it
  you still get scraped and filtered companies; you lose the contact columns.
- Optional: a Crunchbase login, saved once as `.crunchbase.storageState.json`,
  for the second source. Clutch alone works.

What it costs:

- About $4 in Apify credit per run. Scraping and filtering cost $0.
- About 15 minutes to first leads: run `/onboard` in Claude Code and it walks
  your ICP into the gates, your key into `.env`, and the run order. Manual
  version: [.claude/skills/onboard/SKILL.md](.claude/skills/onboard/SKILL.md).

## The gates disqualify, not score

Dead site, info@ only, nobody who owns sales. A row that trips one is out, and
the row says which gate killed it. A binary gate can be debugged; a weighted
score cannot. No lead is marked qualified without a person saying so.

## Three design calls the first run forced

1. **Measure the source before building on it.** A 300-company Crunchbase scrape
   showed 74% had raised past the revenue ceiling and 7% fit the ICP, so Clutch
   became the primary source on day one.
2. **Fail loudly or you fail silently.** The null-rate check in the Clutch
   scraper runs before any file write, because an early run reported success
   while every row was null.
3. **Never claim more than you checked.** Emails pass syntax, live DNS MX, and a
   role-account check, and `email_status` never says `valid` because no SMTP
   handshake runs. A CAPTCHA ends a Crunchbase run instead of being routed
   around.

## Run

```bash
pnpm install
npx playwright install chromium
pnpm test                                # 42 tests green before you trust anything
pnpm scrape:clutch
pnpm scrape:crunchbase                   # optional; needs .crunchbase.storageState.json from a logged-in session
pnpm normalize                           # writes data/companies.csv
pnpm finalize path/to/clay-export.csv    # writes data/leads_final.csv
pnpm mcp                                 # the pipeline as an MCP server
pnpm agent                               # reads data/companies.csv
```

Dry-run on a fresh clone: `cp data/sample-companies.csv data/companies.csv` gives
`pnpm agent` three FICTIONAL rows to chew on before you scrape anything real.

The signal step needs `APIFY_TOKEN` (copy `.env.example` to `.env`). The Clay step
runs through Clay's MCP server, configured in your agent host, not scripted here.

Fresh clone and don't know where to start? [START-HERE.md](START-HERE.md) is the
one door. Which piece runs on which agent host:
[HOST-MATRIX.md](HOST-MATRIX.md).

## What it will not do

Send email, buy data, solve or bypass a CAPTCHA, mark a lead qualified without a
human, or ship anyone's personal data in the repo.

## Provenance

Extracted from a production GTM trial run, August 2026: 100 leads, every email
backed by a live DNS MX record, one human approval gate. No lead data ships here:
lead lists are personal data, so you generate your own (see
[`data/README.md`](data/README.md)).

License: MIT. [LICENSE.md](LICENSE.md).
