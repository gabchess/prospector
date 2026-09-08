# Precision doctrine

The governing rule of this pipeline: a vague spec makes a clean-running
workflow ship garbage. "It ran without errors" and "it produced something you
can act on" are different claims, and only precise definitions tell them
apart. Every vague instruction a prospecting tool usually receives has an
exact counterpart somewhere in this codebase. This document maps them.

## Vague versus precise, with file paths

### "Find the email"

Vague. Precise version: verified work email only; unverified emails get
flagged and are never auto-sent.

Where it lives: `src/pipeline/finalize.ts`. `classifyEmail` checks syntax,
then runs a real DNS MX lookup (`hasMx`, with a cache), then checks whether
the local part is a shared role mailbox (`ROLE_LOCAL_PARTS`: info, hello,
contact, sales, support, admin, team, office, help). The result is one of four
labels: `mx_ok`, `mx_ok_role_account`, `no_mx`, `invalid_format`. The label
`valid` does not exist in `LeadSchema` in `src/icp.ts`, on purpose: nothing in
the pipeline runs an SMTP handshake, so nothing may claim that word. Role
mailboxes are kept as a label rather than silently dropped, because whether
`info@` is acceptable is the reviewer's call, not the machine's.

### "A new lead comes in"

Vague. Precise version: a lead either matches ICP criteria X, Y, Z or it is
routed out, with the gate that killed it named.

Where it lives: `src/icp.ts`. `CompanySchema` is the gate set: country in
`CountrySchema` (US, UK, CA, AU), headcount integer between 11 and 200,
company type in `CompanyTypeSchema`, optional `arr_estimate_usd` between
500,000 and 20,000,000. `src/pipeline/normalize.ts` applies the geo and
headcount gates at merge time, dedupes by domain, and never invents a
midpoint for an ambiguous headcount band (`headcount_ambiguous` stays true
and the low edge is used). `src/scoring.ts` adds hard blockers that survive
scoring: country, company type, headcount, no VP of Sales, no intent signal.
A blocked lead shows its blockers even when its score is computed, so a near
miss stays visible instead of collapsing to a bare zero.

### "Enrich the contact"

Vague. Precise version: decision maker title, company, and work email from
Clay; reject the row if the title does not own sales.

Where it lives: `src/pipeline/salesOwner.ts`. `ownsSales` rejects titles
carrying CTO, CFO, CPO, CIO, Chief Technology, Chief Financial, Chief
Product, Engineer, or Developer, even when the same title also says Founder:
a co-founder who is CTO owns engineering, not the commercial function.
`src/pipeline/finalize.ts` applies it to every enriched row
(`droppedForTitle` counts what fell) before anything is written.

### "Scrape the site"

Vague. Precise version: measure the source before building on it, and abort
loudly when it stops yielding.

Where it lives: `src/scrapers/clutch.ts`. A null-rate check runs before any
file write, because an early run reported success while every row was null.
The scraper logs null rates per field (website, country, size, hq) per
category before committing output. `src/scrapers/crunchbase.ts` keeps 2
seconds between requests and carries a kill switch: CAPTCHA, block page, or a
login redirect throws a `KillSwitchError` and the run ends. No retry, no
rotation, no other source. The kill switch exists outside the page event
handler on purpose, so it cannot be swallowed.

### "Qualify the leads"

Vague. Precise version: score against explicit weights, auto-reject below a
named floor, and stop at a human above it.

Where it lives: `src/agent/qualify.ts` and `src/scoring.ts`. Weights are
explicit and sum to 100 (ICP base 40, hiring signal 20, post signal 20,
stacking bonus 10, senior title 10). `APPROVAL_THRESHOLD` is 40: below it the
agent rejects on its own with reasons logged; at or above it the lead waits
in `data/pending-approval.json` for `pnpm agent --approve`. Every step
appends to `data/agent-log.jsonl`, so the run is inspectable afterward.

## The edge-case self-check

Before shipping any ICP edit, apply this checklist to your own change. The
test: could someone else read your spec and know what happens in every edge
case, not just the happy path.

- [ ] What happens when a row's headcount band is ambiguous ("10 - 49")?
      (Answer in code: low edge used, `headcount_ambiguous=true`, no invented
      midpoint. Does your edit preserve that?)
- [ ] What happens when a domain is missing? (`normalize.ts` keeps the row
      with `needs_domain_lookup=true` for Clay; `qualify.ts` drops candidates
      with no domain before spending a tool call. Which behavior does your
      edit assume?)
- [ ] What happens when the source returns mostly nulls? (The null-rate check
      aborts before write. If your edit adds a field, is its null rate
      reported too?)
- [ ] What happens when an email looks right but the domain has no MX?
      (`no_mx`, flagged, never auto-sent.)
- [ ] What happens when the decision maker is a co-founder CTO?
      (`ownsSales` rejects; the row is dropped at finalize.)
- [ ] What happens when a CAPTCHA appears mid-run? (Kill switch throws; the
      human decides. Your edit must not catch and continue.)
- [ ] Does `pnpm test` parse your new gate? (The suite validates every
      schema in `src/icp.ts`; add your gate to the tests or it fails silently
      later.)
- [ ] Can your edit ever relabel an unverified email as verified? (If yes, it
      does not ship.)
