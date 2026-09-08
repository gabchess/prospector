# Example: reading a rejected row

FIXTURE. The rows come from `data/sample-companies.csv` in the engine repo.
Fictional companies, `.example` domains.

## The row

Acme Outbound Co, acmeoutbound.example, US, headcount 25 (raw band "10 -
49"), lead_gen_agency, source clutch.

## The rejections, in gate order

1. Geo gate, `CountrySchema` in `src/icp.ts`: US passes. Not the killer.
2. Headcount gate: the raw band "10 - 49" is ambiguous. `normalize.ts` takes
   the low edge (11) and sets `headcount_ambiguous=true`. It never invents
   30. 25 passes 11-200 in this fixture, but the ambiguity flag travels with
   the row so a human can see the number is soft.
3. Company type gate: lead_gen_agency is in `CompanyTypeSchema`. Passes.
4. VP of Sales blocker, `src/scoring.ts`: no enrichment ran, so no title
   exists. Blocker: "no VP of Sales found (hard disqualifier in the ICP)".
5. Signal blocker: no Apify pass ran. Blocker: "no intent signal in the
   window (needs hiring or post)".

## How to read it

The row is not "bad". It is "unchecked at two stages that were never run".
The blockers say which. That is the point of gates that disqualify instead of
score: this row is debuggable. Run the signals pass and Clay enrichment, and
blockers 4 and 5 either clear or stay with evidence attached.

## What never happens to this row

It is never auto-sent, never marked qualified, never relabeled. If it ends up
in `data/pending-approval.json`, a human walks it with
`pnpm agent --approve`.
