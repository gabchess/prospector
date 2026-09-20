# Optional lead engine

The plugin works without this engine. Use it for repeatable evidence checks and a reviewed CSV export.

Requires Node 22+ and pnpm. Keep the checkout separate from the installed plugin and private customer data.

```sh
git clone https://github.com/gabchess/prospector.git
cd prospector
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build:leads examples/profile.json examples/leads.json work/demo.json
```

The fictional example includes an incomplete lead and a suppressed account. Nothing is approved or sent. Use a new output filename for each run. Map authorized provider output to the [input contract](../plugins/prospector/skills/prospector/references/data-contract.md).

```sh
pnpm build:leads work/profile.json work/leads.json work/batch.json
pnpm review work/batch.json "Your name" work/approval.json
pnpm export:leads work/batch.json work/approval.json work/approved.csv
```

Review requires a human terminal. Changed batches need fresh approval. Missing, conflicting or stale evidence blocks export. Approval files are local audit records, not tamper-proof authentication; protect workspace access.

The engine checks supplied evidence. It cannot independently verify a provider's claims, and MX checks do not prove email deliverability. Optional opportunity hints do not replace the skill's case assessment.

For a compatible MCP host, run `pnpm mcp` with this checkout as its working directory. It exposes the read-only `assess_leads` tool. It has no approval or sending tool.

Version 0.3 replaced the fixed-profile browser pipeline and host ZIPs. Map 0.2 inputs to the current contract, or keep that release in a separate checkout. Version 0.4 moves the skill into `plugins/prospector`; engine commands stay unchanged.
