# Run log template

One log per run. The skill (builder seat) fills every field; unknowns are
written as "not run" or "unknown", never left blank or invented. Save as
`runs/<date>-<run-id>.md` outside the repo's tracked data, or paste into your
own records. Never paste real lead rows into a shared log: counts and gate
names only, no names, no emails.

```markdown
# Run log

- run_id:            (e.g. 2026-09-08-a)
- date:
- operator:          (who ran it)
- approver:          (who walks the approval gate)

## ICP version

- src/icp.ts hash or commit:   (git rev-parse HEAD, plus any uncommitted edit noted)
- countries:
- headcount band:
- revenue ceiling:
- company types:

## Sources scraped

- clutch: rows captured / null rates per field (paste the scraper's null-rate lines)
- crunchbase: rows captured / skipped and why (no login state, kill switch, not run)
- kill switches fired: (which, at what URL, verbatim message)

## Gate counts

- rows in (merged, pre-gate):
- dropped by geo gate:
- dropped by headcount gate:
- dropped by company type gate:
- deduped by domain:
- rows out to data/companies.csv:
- needs_domain_lookup flagged:

## Signals (Apify)

- token present: yes / no
- apify spend this run (USD):
- rows with hiring signal / post signal / both / none:
- tier_1 / tier_2 / tier_3 counts:

## Clay enrichment

- clay seat present: yes / no
- columns returned: (dm_name, dm_title, dm_linkedin, email, other)
- rows enriched / rows returned empty:
- failure mode if any: (down, seat lapsed, MCP not found; leads stayed unenriched and flagged)

## Finalize

- clay export rows in:
- dropped for non-sales title (ownsSales):
- email_status counts: mx_ok / mx_ok_role_account / no_mx / invalid_format
- rows shipped to data/leads_final.csv:

## Approval

- pending written to data/pending-approval.json:
- approved by human:
- rejected by human:
- marked qualified without a human: (must be 0; if not, the run is invalid)

## Hand-off

- exported file(s) and label: (e.g. "leads_final.csv, gated, MX-checked, human-approved subset")
- degraded-mode labels applied: (companies-not-leads, no-signals, etc.)
```
