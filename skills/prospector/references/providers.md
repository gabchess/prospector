# Choose the user's data tools

Prospector supplies qualification and review. Provider calls run through the agent host or the user's own integration. The package does not bundle provider accounts, a scraper, a paid API adapter or browser sessions.

## Clay

Clay's [agent plugin](https://university.clay.com/docs/clay-api-cli) supplies skills and a CLI for coding agents. Its [MCP connection](https://university.clay.com/docs/connect-to-clay-mcp) is separate. Use whichever the user configures. Inspect the actual available commands or tools and workspace before a call. Confirm plan access, limits and spend; installation alone proves neither authentication nor enrichment access.

Follow the official setup for that host. Keep login tokens in the provider/host credential store. Map returned companies, contacts and source information to Prospector's contract. If the provider omits verification or evidence, preserve the unknown. A user-owned export can substitute for a live connection.

## Crunchbase

Use an authorized export or a licensed API connection. See [Crunchbase API access](https://data.crunchbase.com/docs/using-the-api). Authentication and available endpoints depend on the account. Preserve record URLs and applicable attribution. Do not republish provider datasets or bypass an access wall. This repository grants no provider data rights.

## Other sources

The same input contract accepts another approved directory, CRM export or enrichment tool. Add the source name to the profile, map its fields, and run the checks. Prove a single bounded read before a batch. Confirm the destination and approval before any tool that writes, enriches at a cost, or exports externally. Stop when the approved budget is exhausted; never change credentials or providers to evade a limit.

## Per-run record

Keep the profile version, approved providers and call scope, spend ceiling, source counts, rejected reasons, unresolved evidence and output paths privately. Secrets and real contacts never belong in the installed skill or a public commit. No live provider verification is claimed by the repository's offline tests.
