# Clay integration

Clay is the enrichment centerpiece of this pipeline. The contact columns
(decision maker, sales owner, work email) come from Clay, run through Clay's
MCP server in the installer's agent host. Nothing in this repo calls Clay
directly and nothing in this repo holds a Clay key.

## Setup in the host

1. Have a Clay seat. The repo cannot create or verify one.
2. Configure Clay's MCP server in your agent host (Claude Code, or any host
   that speaks MCP). This is a host-side configuration; `.env.example` in the
   repo states it explicitly: Clay runs through its own MCP server, not
   scripted here.
3. Build a Clay table that accepts the domains from `data/companies.csv`
   (written by `pnpm normalize`). Rows with
   `needs_domain_lookup=true` are exactly the ones Clay should resolve:
   normalize keeps a missing website instead of guessing, so Clay does the
   lookup.
4. Add the enrichment columns: decision maker name, decision maker title,
   decision maker LinkedIn URL, work email.
5. Export the table as CSV. That file is the input to finalize:

```bash
pnpm finalize path/to/clay-export.csv
```

## The columns finalize expects

`src/pipeline/finalize.ts` reads the Clay export by column name:

- `domain`: the join key back to `data/companies_signals.csv`.
- `name`, `country`, `headcount_raw`: company identity, used when the signal
  row lacks them.
- `dm_name`, `dm_title`, `dm_linkedin`: the decision maker. `dm_title` is
  also used as `sales_owner_title` and must pass `ownsSales`
  (`src/pipeline/salesOwner.ts`) or the row is dropped.
- `email`: classified by `classifyEmail` into `mx_ok`,
  `mx_ok_role_account`, `no_mx`, or `invalid_format`. Clay's MCP surface
  returns the address without the waterfall's validation column, which is
  exactly why finalize runs its own MX check instead of trusting an
  upstream "verified" claim.
- `signal_tier` (optional): defaults to `tier_3` when absent.

## The human gate

Clay output is input, not truth. After finalize, `pnpm agent` scores rows and
stops at the approval gate in `src/agent/qualify.ts`. No lead enriched by
Clay is marked qualified until a human approves it with
`pnpm agent --approve`. Clay can return a stale title, a catch-all address,
or the wrong person for a domain; the MX check and the sales-owner gate catch
some of that, and the human catches the rest.

## Failure modes

- Clay down, seat lapsed, or MCP server not found in the host: leads stay
  unenriched and flagged. Never guessed. Export `data/companies.csv` as
  "companies, not leads" and record it in the run log
  (`references/run-log-template.md`). Do not fabricate contact columns from
  any other source and label them Clay output.
- Clay returns an email but no title: the row fails `ownsSales` (empty
  title) and is dropped at finalize. That is the gate working, not a bug.
- Clay returns a role mailbox (info@): kept as `mx_ok_role_account` and
  flagged for the reviewer. The human decides if a shared inbox is
  acceptable.
- Column names differ from the table above: finalize reads empty strings and
  the schema validation in `LeadSchema` rejects the rows loudly at write
  time. Fix the export headers, not the code.
