# Changelog

## 0.2.0 - 2026-09-08

The augment cut. The repo now ships as an installable skill package alongside
the engine.

- Added the codex skill tree at `codex/prospector/`: SKILL.md, knowledge,
  personas, evals, examples, fallbacks, references, trigger evals.
- Added `claude/prospector-v0.2.0.zip`, a single-root skill zip, with
  `scripts/build_zip.mjs` (`pnpm zip`) and `claude/README.md`.
- Added `release-manifest.json` and `documentation-manifest.json` with a
  generator (`pnpm manifests`, `pnpm manifests:check`) and a drift test.
- Added the envelope docs: `PROVENANCE.md`, `LICENSE-STATUS.md`, `AGENTS.md`,
  the T-NOVA one-pager, and the `docs/` suite (install, operate, first run,
  trust, validation limits, troubleshooting, recovery, extend, walkthrough,
  human gaps).
- Upgraded `START-HERE.md` to one door covering host install and the engine
  dry run; extended `HOST-MATRIX.md` with the codex and claude targets.
- Rewrote `README.md` with an install-as-augment door and a docs table.
- Renamed one fictional sample company so no internal codename appears in
  fixture data.
- Bumped the package version to 0.2.0.

## 0.1.1 - 2026-09-07

- Repositioned the README utility-first; added `START-HERE.md` and
  `HOST-MATRIX.md`.
- Bumped the MCP SDK for patched transitive dependencies; `pnpm audit` clean.

## 0.1.0 - 2026-08-25

- Initial open-source cut: Clutch and Crunchbase scrapers with kill switches,
  normalize gates, the Apify signal pass, Clay-over-MCP enrichment as a
  documented host step, finalize with the MX check and sales-owner gate, the
  MCP server, the ReAct qualify agent with the human approval gate, and the
  `/onboard` skill.
- Removed the Loom walkthrough link before release.
