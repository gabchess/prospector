# Install for Claude

Two routes, same split: the zip is the skill door, the engine lives in this
repo and is not bundled inside it. Engine placement is Option B: skill
package separate from the code it drives, repo as the single source of truth
for the engine.

## Route 1: the zip

`claude/prospector-v0.2.0.zip` has a single root folder, `prospector/`, with
`SKILL.md` at its top. Upload or unpack it wherever your host installs skills:

```bash
unzip claude/prospector-v0.2.0.zip -d ~/.claude/skills/   # adjust to your host's skill root
```

Rebuild it any time from the repo with `pnpm zip`
([../scripts/build_zip.mjs](../scripts/build_zip.mjs)).

## Route 2: the repo

```bash
git clone https://github.com/gabchess/prospector
```

The codex tree at `codex/prospector/` and the zip contents are identical;
either works for a Claude host. The repo route also carries the `/onboard`
skill at `.claude/skills/onboard/`, which the zip does not.

## Engine reachability caveat

A skill-only install gives your agent chat guidance and the exact `pnpm`
commands to relay. The scrapers, gates, and finalize step need the repo
itself, on a machine with node and pnpm:

```bash
cd prospector
pnpm install --frozen-lockfile
npx playwright install chromium
pnpm test
```

Without the repo beside the skill, the agent can explain the pipeline but
cannot run it.

## First move

[FIRST-RUN.md](FIRST-RUN.md): dry run on three fictional rows, then
`/onboard` for your real ICP.
