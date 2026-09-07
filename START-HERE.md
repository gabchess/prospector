# Start here

One door for whoever installs this, human or agent. Two phases: a dry run on
fictional data (about 5 minutes), then your real ICP (about 15 minutes).

## Phase 1: dry run

```bash
git clone https://github.com/gabchess/prospector
cd prospector
pnpm install --frozen-lockfile
npx playwright install chromium
pnpm test                                # 42 tests green before you trust anything
cp .env.example .env                     # add your APIFY_TOKEN; only the signal step needs it
cp data/sample-companies.csv data/companies.csv
pnpm agent                               # scores the 3 fictional rows, stops at the approval gate
```

`pnpm agent` spawns the MCP server itself, so this one command proves the server,
the scoring, and the human approval gate all work. No lead is marked qualified;
the sample rows are fictional by design.

Requires: node and pnpm. Nothing else for phase 1.

## Phase 2: your ICP

Run `/onboard` in Claude Code. It walks three steps, about 15 minutes:

1. Your ICP into `src/icp.ts`: geo, headcount band, revenue ceiling, service
   categories.
2. Your keys into `.env`.
3. The run order: scrape, normalize, signals, Clay enrichment, finalize.

Not on Claude Code? The manual walkthrough is the same document:
[.claude/skills/onboard/SKILL.md](.claude/skills/onboard/SKILL.md). Which piece
runs on which host: [HOST-MATRIX.md](HOST-MATRIX.md).

For a real run you also need:

- An Apify token (about $4 in credit per run).
- A Clay seat, with Clay's MCP server configured in your agent host.
- Optional: a Crunchbase login saved as `.crunchbase.storageState.json` for the
  second source.

## What Prospector is not

It does not send email. It does not buy data. It does not solve or bypass a
CAPTCHA; a CAPTCHA ends the run. It does not mark a lead qualified without a
human. It does not ship anyone's personal data in this repo.
