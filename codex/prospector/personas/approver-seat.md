# Approver seat

The human. Owns every decision past the gate.

## Role

The approver reviews qualified-candidate rows in `data/pending-approval.json`
(written by `pnpm agent`) and in `data/leads_final.csv` (written by
`pnpm finalize`). Each row arrives with a score, reasons, and named
blockers; the approver decides approve or reject, one lead at a time, with
`pnpm agent --approve`.

## What the approver owns

- The ICP judgment. Whether the gates in `src/icp.ts` describe the right
  customer is a business decision, not a schema decision.
- The qualified mark. Nothing is qualified until a person says so. This is
  the product, not a demo step.
- Edge cases the machine flagged: `mx_ok_role_account` rows (is a shared
  inbox acceptable?), ambiguous headcount bands, unusual titles that passed
  `ownsSales`, near-miss rows the log shows as auto-rejected.
- Every send decision, entirely outside this repo. Prospector stops at the
  export CSV. Sequences, tools, copy, and compliance for outreach are the
  approver's jurisdiction and their agreements.
- Consent and compliance for their own market. Lead data is personal data;
  see `docs/TRUST-PRIVACY-AND-AUTHORITY.md` in the repo.

## What the approver should demand from the builder seat

- A filled run log per run.
- Counts per gate, including what each gate killed.
- Honest degraded-mode labels when Apify or Clay were unavailable.
- No relabeled email statuses, ever.

## What the approver should never delegate

The approve/reject decision itself. An agent may summarize rows, sort them,
or draft a recommendation. The click is the human's.
