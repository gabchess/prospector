---
name: prospector
description: >-
  Runs the Prospector B2B outbound lead pipeline. Use when an installer says
  "find me leads", "build my ICP pipeline", "prospect for my company", "who
  matches my ideal customer profile", or "run the lead gates". Scrapes Clutch
  and Crunchbase, reads intent signals through Apify, enriches through the
  installer's own Clay seat, and stops at a human approval gate. Not for
  sending email, writing sequences, or buying data.
---

# Prospector

One launch-ops operator for B2B prospecting: it builds the lead list and
stops at a human. The promise is a CSV of gated, evidence-labeled leads, not a
guarantee of replies.

## Trust and do-not

Mirrors START-HERE.md in the engine repo:

- Never send email. Everything after the approval gate lives outside this
  repo.
- Never buy data or route around a login wall, CAPTCHA, or block page. A
  CAPTCHA ends the run.
- Never mark a lead qualified without a human approving it.
- Never commit real lead data. Leads are personal data; `data/` outputs stay
  gitignored.
- Never claim an SMTP verification. `email_status` never says `valid` because
  nothing in the pipeline runs a handshake.

## Run spine

The full order, from the engine repo:

1. Set ICP: edit `src/icp.ts` (geo, headcount band, revenue ceiling, company
   type), then `pnpm test`. A typo fails here, loudly, before any scrape.
2. Scrape: `pnpm scrape:clutch`, optional `pnpm scrape:crunchbase` (needs a
   saved login state). Writes raw rows to `data/raw/`.
3. Normalize and gate: `pnpm normalize` merges both sources, normalizes
   domains, applies geo and headcount gates, dedupes. Writes
   `data/companies.csv`.
4. Signals: the Apify pass reads LinkedIn jobs and posts, needs
   `APIFY_TOKEN`, about $4 per run. Writes `data/companies_signals.csv`.
5. Clay enrich: through Clay's MCP server in the installer's host, not
   scripted here. Columns: decision maker, sales owner, work email. See
   `knowledge/clay-integration.md`.
6. Finalize: `pnpm finalize path/to/clay-export.csv` runs a real DNS MX check
   on every email, drops non-sales titles, ranks by tier, schema-validates
   every row. Writes `data/leads_final.csv`.
7. Human approval: `pnpm agent` scores each row and stops at the approval
   gate in `src/agent/qualify.ts`. Pending leads land in
   `data/pending-approval.json`; the installer walks them with
   `pnpm agent --approve`.
8. Export: `data/leads_final.csv` is the handoff shape for whatever send
   infra the installer owns.

## Precision doctrine

The governing rule: a vague spec makes a clean-running workflow ship garbage.
Prospector already lives the precise version of every vague request. Full
mapping with file paths: `knowledge/precision-doctrine.md`. Short form:

- "Find the email" becomes: verified work email only. `src/pipeline/finalize.ts`
  checks syntax, live DNS MX, and role-account shape; `email_status` reports
  exactly what was checked and never says `valid`.
- "A new lead comes in" becomes: the row matches the ICP gates in
  `src/icp.ts` or it is rejected with the gate named.
- "Enrich the contact" becomes: title, company, and email from Clay, with
  non-sales titles dropped by `ownsSales` in `src/pipeline/salesOwner.ts`.

## Downshift ladder

- No Apify token: scrape and filter still run. Signals fall to
  `no verifiable signal found`, tier_3. Say so in the run log.
- No Clay seat: export companies without contacts.
  `data/companies.csv` is still honest output; label it "companies, not
  leads" when handing it over.
- No agent host: plain `pnpm` commands per the repo README. The skill is
  guidance; the engine runs without any agent at all.
- CAPTCHA or block page: stop. Not route around. The kill switches in
  `src/scrapers/crunchbase.ts` and `src/scrapers/clutch.ts` throw on purpose;
  a human decides the next move.

## Evidence states for leads

Every lead carries one of these, with the gate that decided it:

- `verified_mx`: syntax plus a live DNS MX record
  (`classifyEmail` in `src/pipeline/finalize.ts`). Not SMTP-verified.
- `role_matched`: title clears `ownsSales` in
  `src/pipeline/salesOwner.ts`; non-sales titles are dropped at finalize.
- `unverified_flagged`: `mx_ok_role_account`, `no_mx`, or
  `invalid_format`. Flagged, never auto-sent, never relabeled.
- `rejected_by_gate`: killed by a named gate. Which one is in the row or the
  agent log (`data/agent-log.jsonl`): country, headcount, company type,
  missing VP of Sales, no intent signal, non-sales title, or the score floor
  in `src/agent/qualify.ts`.

## Seats

Two personas, in `personas/`: the builder seat runs the pipeline and never
marks a lead qualified alone; the approver seat is the human who reviews
qualified candidates and owns every send decision outside this repo.

## Per-run record

Fill `references/run-log-template.md` for every run: run id, ICP version,
sources, rows in and out per gate, Apify spend, Clay columns returned,
approvals. A run without a log is a run that cannot be audited.
