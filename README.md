# Prospector

A GTM lead pipeline you can fork. An augment: the pipeline plus the playbook that
teaches an AI assistant to run it. Fork it, run `/onboard` in Claude Code, set your
own ICP in the gates, drop in your key, and it finds qualified leads for YOUR
customer profile.

The gates disqualify rather than score: dead site, info@ only, nobody who owns
sales. A row that trips one is out, and the row says which gate killed it.

Provenance, stated plainly: extracted from a pipeline built in 48 hours for a real
GTM trial task in August 2026. That run produced 100 leads with every email backed
by a live DNS MX record, for $4.12 of new spend. The run was the proof; this
pipeline is the product. No lead data ships here: lead lists are personal data, so
you generate your own (see [`data/README.md`](data/README.md)).

## Three design calls the first run forced

1. **Measure the source before building on it.** The first Crunchbase scrape of 300
   companies showed 74% had raised past the revenue ceiling and 7% fit the ICP, so
   Clutch became the primary source on day one. Agencies rarely raise venture
   capital; Clutch lists them by service.
2. **Fail loudly or you fail silently.** An early run wrote a file and reported
   success while every row was null. The null-rate check in the Clutch scraper now
   runs before any file write.
3. **Never claim more than you checked.** Emails pass syntax, live DNS MX, and a
   role-account check. No SMTP handshake runs, so `email_status` never says
   `valid`. A CAPTCHA ends a Crunchbase run instead of being routed around.

## Pipeline

```
src/icp.ts                   The ICP as zod schemas: the company gate and the shape of a shipped lead.
src/scrapers/crunchbase.ts   Playwright. Logged-in saved search, real pagination, 2s between requests, stops on CAPTCHA.
src/scrapers/clutch.ts       Playwright. Category listings, null-rate check before it writes anything.
src/pipeline/normalize.ts    Merge both sources, normalize domains, ICP geo and headcount filter, dedupe by domain.
Apify actors                 LinkedIn jobs and posts for the intent signal.
Clay                         Decision maker, sales owner, work email, through Clay's MCP server.
src/pipeline/finalize.ts     Join Clay output, MX check, drop non-sales titles, rank by tier, validate every row.
```

`src/mcp/server.ts` exposes the pipeline as an MCP server with four tools.
`src/agent/qualify.ts` drives it, scores each lead against the ICP, and stops at a
human approval gate. No lead is marked qualified without a person saying so.

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

## Fork it for your own ICP

`/onboard` in Claude Code walks the whole setup: your ICP into `src/icp.ts`, your
key, the run order. About 15 minutes. Manual version:
[.claude/skills/onboard/SKILL.md](.claude/skills/onboard/SKILL.md).

A run costs about $4 in Apify credit. Scraping and filtering cost $0.

## What it will not do

Send email, buy data, solve or bypass a CAPTCHA, mark a lead qualified without a
human, or ship anyone's personal data in the repo.

License: MIT. [LICENSE.md](LICENSE.md).
