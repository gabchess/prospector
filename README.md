# Prospector

Build a B2B lead shortlist with your AI agent and chosen data tools.

Define your customer profile, research accounts and enrich contacts through Clay, Crunchbase or another configured source. Prospector checks the evidence and keeps the final export behind human review.

## Try it locally

Requires Node 22+ and pnpm. No API key is needed for the fictional example.

```sh
git clone https://github.com/gabchess/prospector.git
cd prospector
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build:leads examples/profile.json examples/leads.json work/demo.json
```

The example intentionally produces an incomplete lead and a suppressed account. Nothing is approved or sent. Use a new output filename for each run.

## Use with an agent

**Codex:** copy `skills/prospector` into your Codex skills directory, or explicitly ask Codex to use this repository's `skills/prospector/SKILL.md`. Start a new task after installing. Keep the engine checkout separate from private lead data.

**Claude Code:** start `claude --plugin-dir /absolute/path/to/prospector` and ask it to use Prospector. The plugin loads the same skill. Engine dependencies must be installed in the checkout.

**Other hosts:** read the skill and use the CLI, or connect `pnpm mcp` as a local stdio server with this checkout as its working directory. It exposes `assess_leads` only. It has no approval or sending tool.

Start with: “Help me define my customer profile and configure a B2B lead workflow.” The agent asks about your offer, sources and budget before paid research. [Provider setup](skills/prospector/references/providers.md) covers Clay, Crunchbase and custom inputs.

## Review and export

```sh
pnpm build:leads work/profile.json work/leads.json work/batch.json
pnpm review work/batch.json "Your name" work/approval.json
pnpm export:leads work/batch.json work/approval.json work/approved.csv
```

The review command requires a human terminal. Changed batches need fresh approval. Missing, conflicting or stale evidence blocks export. A title does not establish buying authority; an engaged opportunity gets a separate evidence-based next step.

## Limits

The engine checks supplied evidence; it does not independently verify a provider's claims. MX checks do not prove deliverability. Approval files are local audit records, not tamper-proof authentication. Protect workspace access and provider credentials.

Live tools, subscriptions and paid API calls belong to the user. This release does not bundle provider adapters or prove a live Clay/Crunchbase run. It sends no outreach. Read [host verification](HOST-MATRIX.md) and [the input contract](skills/prospector/references/data-contract.md).

Version 0.3 replaces the fixed-ICP browser pipeline and separate host ZIPs. Existing 0.2 input files need mapping to the new contract; use a separate checkout if you still need that version. No private leads ship here.

[MIT license](LICENSE.md).
