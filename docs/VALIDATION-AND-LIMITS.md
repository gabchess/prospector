# Validation and limits

## What the tests prove

`pnpm test` runs 42 tests across five files
(`src/icp.test.ts`, `src/scoring.test.ts`, `src/pipeline/csv.test.ts`,
`src/pipeline/normalize.test.ts`, `src/pipeline/salesOwner.test.ts`). They
prove:

- **Gate logic.** The zod schemas in `src/icp.ts` accept and reject exactly
  the documented shapes; scoring weights, blockers, and the qualified flag
  behave as specified; `ownsSales` rejects non-sales titles; normalize's
  headcount bands, dedupe, and geo filters work as documented.
- **Schemas.** CSV round-tripping, field escaping, and the `LeadSchema`
  refinements (tier_1 requires a signal URL).

## What the tests do not prove

- **Live scrape success.** Clutch and Crunchbase change layout and defenses
  on their own schedule. The scrapers are not exercised in CI; the null-rate
  check and kill switches are the runtime protection.
- **Lead quality.** No test can tell you a gated list converts. The trial
  run behind this repo shipped 100 MX-backed leads; your ICP and your market
  are different.
- **Deliverability.** An MX record means the domain accepts mail, not that a
  mailbox exists or that your sending reputation survives the send.
- **Clay behavior.** Clay runs in your host against your seat. Column
  availability, accuracy, and rate limits are Clay's surface, not this repo's
  code.

## email_status semantics

| Value | What was checked | What it does NOT mean |
|---|---|---|
| `mx_ok` | Syntax valid and the domain has a live DNS MX record | The mailbox exists; anyone reads it; mail to it will not bounce |
| `mx_ok_role_account` | Same checks, and the local part is a shared mailbox (info@, sales@, and friends) | A person will see it; it is unacceptable (that is the reviewer's call) |
| `no_mx` | The domain has no MX record | The domain does not exist; it may host a site without mail |
| `invalid_format` | The string is not shaped like an email | Nothing; it is simply unusable |

There is deliberately no `valid` value. The enum in `src/icp.ts` cannot
express it, because nothing in the pipeline performs an SMTP handshake. Any
tool that tells you an address is "verified" without a handshake is selling
you a guess.

## MX check is not SMTP verification

`hasMx` in `src/pipeline/finalize.ts` calls `dns.resolveMx`. That is a DNS
question with a DNS answer: this domain has mail servers. SMTP verification
(RCPT TO against the mail server) is a different check this pipeline does not
perform, partly because many servers refuse it and partly because hammering
mail servers to pre-validate cold lists is exactly the behavior that gets
sending domains blacklisted. The honest label is `mx_ok`, and the human
approval gate is the backstop.
