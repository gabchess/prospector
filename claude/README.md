# claude/

`prospector-v0.2.0.zip` is the Claude-route skill package. Single root folder
`prospector/`, `SKILL.md` at its top, full interior identical to
`codex/prospector/`.

## What rides inside

The skill door only: SKILL.md, README.md, manifest.json, knowledge, personas,
evals, examples, fallbacks, references, trigger-evals.

## What does NOT ride inside

The pipeline engine. `src/` stays in this repo, and the zip does not bundle
it. Engine placement is Option B: the skill package is separate from the code
it drives, and the repo is the single source of truth for the engine. A
skill-only install gives your agent chat guidance and the exact `pnpm`
commands; the scrapers, gates, and finalize step need a clone of this repo
(see [../docs/INSTALL-CLAUDE.md](../docs/INSTALL-CLAUDE.md)).

## Rebuild

```bash
pnpm zip        # node scripts/build_zip.mjs, zips codex/prospector/ from a single root
```

Rebuild after any skill-tree edit and before `pnpm manifests`, so the zip
hash in `release-manifest.json` matches what ships.
