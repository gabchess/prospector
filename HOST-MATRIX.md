# Host matrix

Which piece of Prospector runs where. Evidence is honest: "repo" means verifiable
by reading this repository, "run" means executed on a plain terminal, "not
proven" means no evidence either way.

| Piece | Where it runs | Evidence |
|---|---|---|
| Pipeline scripts (`test`, `scrape:*`, `normalize`, `finalize`) | Any host with node and pnpm | Repo: plain tsx scripts in `package.json`, no agent host involved |
| `/onboard` skill | Claude Code: included at `.claude/skills/onboard`; other hosts: the manual SKILL.md walkthrough works | Repo: the skill is one markdown document with no Claude-only mechanism |
| MCP server (`pnpm mcp`) | Any MCP host over stdio | Repo: `src/mcp/server.ts` uses the stdio transport from the MCP SDK |
| Clay enrichment step | Requires Clay's MCP server configured in your agent host | Repo: `.env.example` and README both state it is not scripted here |
| Agent qualify loop (`pnpm agent`) | Any host with node and pnpm; it spawns the MCP server as its own subprocess | Run: dry run executed on a plain terminal, 3 fictional rows scored, stopped at the approval gate |
| `/onboard` as an interactive slash command | Claude Code only | Not proven on other hosts |

Two honest limits:

- The scrapers need a headed browser (Playwright chromium), so headless CI
  boxes are not proven for the scrape steps.
- The Clay step depends on your Clay seat and your host's MCP config, neither of
  which this repo can verify.
