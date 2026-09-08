# Host matrix

Capability by host, with evidence. Evidence is honest: "repo" means verifiable
by reading this repository, "run" means executed on a plain terminal, "not
proven" means no evidence either way.

| Capability | Codex skill tree | Claude zip | Plain repo, no agent host | Evidence |
|---|---|---|---|---|
| Skill guidance loaded into the host | Yes, `codex/prospector/` | Yes, `claude/prospector-v0.2.0.zip` | Not applicable | Repo: markdown skill files in both packages |
| Engine commands (`test`, `scrape:*`, `normalize`, `finalize`, `mcp`, `agent`) | Through a repo clone | Through a repo clone | Direct | Run: tests green and the dry run executed on a plain terminal |
| `/onboard` as an interactive slash command | Not proven | Claude Code only | Manual walkthrough of the same SKILL.md | Repo: the skill is one markdown document with no Claude-only mechanism |
| MCP server (`pnpm mcp`) | Any MCP host over stdio | Any MCP host over stdio | Direct | Repo: `src/mcp/server.ts` uses the stdio transport from the MCP SDK |
| Clay enrichment step | Needs your Clay seat and your host's MCP config | Same | Not scripted here | Repo: `.env.example`, README, and `docs/INSTALL-*.md` all state the split |
| Scrape steps | Need headed Playwright chromium where the repo runs | Same | Same | Repo: the scrapers drive a real browser |
| Fresh-host automatic activation | Not proven | Not proven | Not applicable | Unverified: no fresh-host install has been executed against either package |

Two honest limits:

- The scrapers need a headed browser (Playwright chromium), so headless CI
  boxes are not proven for the scrape steps.
- The Clay step depends on your Clay seat and your host's MCP config, neither
  of which this repo can verify.

The zip carries the skill door only. The engine (`src/`) lives in this repo and
is not bundled: see [claude/README.md](claude/README.md) for the placement
decision.
