# Start here

One door for whoever installs Prospector, human or agent.

Prospector is a B2B outbound lead pipeline you point at your own ICP. It scrapes
Clutch and Crunchbase, reads intent signals through Apify, enriches contacts
through your own Clay seat over MCP, runs disqualifying gates on every row, and
stops at a human approval gate before any lead ships. It does not send email and
it does not buy data.

## Fastest path to value

1. Choose your host: the codex skill tree at [codex/prospector/](codex/prospector/)
   or the claude zip at [claude/README.md](claude/README.md). Install guides:
   [docs/INSTALL-CODEX.md](docs/INSTALL-CODEX.md) and
   [docs/INSTALL-CLAUDE.md](docs/INSTALL-CLAUDE.md).
2. Clone the engine. The skill package is the door; the pipeline itself runs
   from this repo. Both install docs explain the split.
3. First read: [docs/FIRST-RUN.md](docs/FIRST-RUN.md), a dry run on three
   fictional rows, about 5 minutes.
4. Point it at your ICP: run `/onboard` in Claude Code, or follow
   [.claude/skills/onboard/SKILL.md](.claude/skills/onboard/SKILL.md) on any
   other host, about 15 minutes.

## First ask

Once the skill is loaded in your host, say:

    Find me 20 leads that match my ICP.

On a fresh install that request should route you to the dry run first, because
a real run needs your ICP in the gates and your keys in `.env`. The dry-run
commands, in order:

```bash
git clone https://github.com/gabchess/prospector
cd prospector
pnpm install --frozen-lockfile
npx playwright install chromium
pnpm test
cp data/sample-companies.csv data/companies.csv
pnpm agent                # scores the 3 fictional rows, stops at the approval gate
```

`pnpm agent` spawns the MCP server itself, so this one command proves the
server, the scoring, and the human approval gate all work.

## Inputs you may bring

- An Apify token (about $4 in credit per run). Only the signal step needs it.
- A Clay seat, with Clay's MCP server configured in your agent host. Without it
  you still get scraped and filtered companies; you lose the contact columns.
- Optional: a Crunchbase login saved once as `.crunchbase.storageState.json`.
  Clutch alone works.
- Your ICP: geographies, headcount band, revenue ceiling, company categories.
  These go in `src/icp.ts` as zod schemas during onboard.

## Privacy

Lead lists are personal data. This repo ships zero of it, and your fork never
should either: real outputs stay gitignored under `data/`. You own consent and
compliance for your jurisdiction. Read
[docs/TRUST-PRIVACY-AND-AUTHORITY.md](docs/TRUST-PRIVACY-AND-AUTHORITY.md)
before your first real run.

## What Prospector is not

It does not send email. It does not buy data. It does not solve or bypass a
CAPTCHA; a CAPTCHA ends the run. It does not mark a lead qualified without a
human. It does not ship anyone's personal data in this repo.

Which piece runs on which host: [HOST-MATRIX.md](HOST-MATRIX.md). Where this
repo came from: [PROVENANCE.md](PROVENANCE.md).
