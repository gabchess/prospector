# Install for Codex-style hosts

Two pieces, installed separately:

1. **The skill** (this repo's `codex/prospector/` tree): guidance an agent
   loads so it can run the pipeline and read the gates.
2. **The engine** (this repo's `src/`): the TypeScript pipeline that actually
   scrapes, gates, and finalizes.

A skill-only install gives your agent chat guidance and the right `pnpm`
commands. The scrapers still need a clone of this repo on a machine with node
and pnpm. Plan on both.

## Skill install

Point your agent host at the skill tree. Typical placement, following your
host's skill directory convention:

```bash
git clone https://github.com/gabchess/prospector
cp -r prospector/codex/prospector ~/.codex/skills/prospector   # adjust to your host's skill root
```

Then ask your agent to confirm it can see `SKILL.md`. A visible folder is not
proof the skill is active: fresh-host automatic activation is Not proven in
[HOST-MATRIX.md](../HOST-MATRIX.md).

## Engine install

```bash
cd prospector
pnpm install --frozen-lockfile
npx playwright install chromium
pnpm test          # green before you trust anything
```

Copy `.env.example` to `.env` and add `APIFY_TOKEN` if you will run the signal
pass. Configure Clay's MCP server in your host separately if you have a Clay
seat; see [../codex/prospector/knowledge/clay-integration.md](../codex/prospector/knowledge/clay-integration.md).

## First move

Run the dry run in [FIRST-RUN.md](FIRST-RUN.md), then point the pipeline at
your ICP with the onboard skill
([../.claude/skills/onboard/SKILL.md](../.claude/skills/onboard/SKILL.md),
host-neutral markdown).
