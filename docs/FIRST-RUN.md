# First run

About 5 minutes on fictional data, before you spend a dollar or touch your
ICP.

## The first-ask ritual

Load the skill in your host and say:

    Find me 20 leads that match my ICP.

On a fresh install the honest answer is "first we prove the machine, then we
point it at you." That is this document.

## Step 1: dry run

```bash
git clone https://github.com/gabchess/prospector
cd prospector
pnpm install --frozen-lockfile
npx playwright install chromium
pnpm test
cp data/sample-companies.csv data/companies.csv
pnpm agent
```

`pnpm agent` spawns the MCP server itself, so this proves the server, the
scoring, and the human approval gate in one command.

## Step 2: read the gate output

Expected on the sample data: three fictional rows perceived, three scored,
three auto-rejected below the 40-point threshold, "Nothing reached the
approval gate." The rejections are correct: the fixture rows have no Clay
enrichment (no VP of Sales title) and no Apify signals. The blockers in
`data/agent-log.jsonl` name exactly that. If you see those blockers, the
gates work.

## Step 3: your real ICP

Run `/onboard` in Claude Code, or follow
[../.claude/skills/onboard/SKILL.md](../.claude/skills/onboard/SKILL.md) on
any host. Three steps, about 15 minutes:

1. Your ICP into `src/icp.ts`: geographies, headcount band, revenue ceiling,
   company categories. Then `pnpm test`: a typo fails here, not mid-scrape.
2. Your keys into `.env`: `APIFY_TOKEN` for the signal pass (about $4 per
   run). Clay is configured in your host, not in this repo.
3. The run order: scrape, normalize, signals, Clay enrich, finalize,
   approval. Full version: [OPERATE-PROSPECTOR.md](OPERATE-PROSPECTOR.md).

## Before the first real run

Read [TRUST-PRIVACY-AND-AUTHORITY.md](TRUST-PRIVACY-AND-AUTHORITY.md). Leads
are personal data: real outputs stay gitignored, you own consent and
compliance for your market, and nothing past the approval gate is this
repo's business.
