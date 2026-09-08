# Trust, privacy, and authority

## Lead data is personal data

A lead list is a list of named people with their work contact details. Treat
it that way everywhere:

- **The repo ships zero personal data.** `data/sample-companies.csv` holds
  three fictional rows with `.example` domains. That is the only data file
  tracked by git.
- **Never commit real leads.** `.gitignore` excludes every real output:
  `data/companies.csv`, `data/companies_signals.csv`, `data/leads_final.csv`,
  `data/raw/*.csv`, `data/agent-log.jsonl`, and your Crunchbase login state.
  Keep it that way in your fork.
- **Run logs carry counts, not rows.** Gate names and numbers are shareable;
  names and emails are not.

## You own consent and compliance

Which outreach is lawful, what notice a market requires, and how long you may
keep contact data depends on your jurisdiction and your situation. Nothing in
this repo grants, checks, or replaces that. Review the terms of service of
every source you touch (Clutch, Crunchbase, LinkedIn via Apify, Clay) under
your own agreements; see [../LICENSE-STATUS.md](../LICENSE-STATUS.md).

## What the approval gate protects

`src/agent/qualify.ts` stops every run at a human decision: leads below the
score floor are auto-rejected with reasons; leads at or above it wait in
`data/pending-approval.json` until a person walks them with
`pnpm agent --approve`. The gate protects three things:

1. **List quality.** A machine that cannot verify intent or identity should
   not have the final word on who you contact.
2. **You.** Every row that ships has a human decision attached, so "why is
   this person on the list" always has an answer.
3. **The people on the list.** A human reviewing the row is the last chance
   to catch a mis-enriched contact, a role mailbox, or someone who clearly
   does not want outbound.

## Authority boundaries

- The agent never sends email, posts messages, edits a CRM, or spends money
  beyond the Apify credit the installer provisioned.
- Kill switches (CAPTCHA, block page, login wall, null-rate abort) end runs
  instead of routing around walls. Only a human decides what happens next.
- `email_status` never claims more than was checked. An MX record is not an
  SMTP verification, and the pipeline says so in the data itself.
