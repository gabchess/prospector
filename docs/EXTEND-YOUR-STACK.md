# Extend your stack

Optional leave-behind. None of this is wired into v0.2.0. Prospector ends at
`data/leads_final.csv`, gated, MX-checked, human-approved. What happens after
that file is entirely the installer's choice, on the installer's own
accounts and agreements.

## The handoff shape

`data/leads_final.csv` columns include company, domain, country, headcount,
company type, decision maker name, title, LinkedIn URL, email, email_status,
signal tier, type, evidence, and URL, source, origin URL, captured_at. Every
send tool below ingests a CSV like this; map your columns at import.

## Send infrastructure (pick one, or none)

- **Smartlead:** cold email at volume with inbox rotation and warmup. Suits
  teams running multiple sending domains.
- **Instantly:** same category, simpler surface, popular with lean outbound
  teams.

Both are paid services with their own terms. Prospector does not integrate
with either, send nothing to either, and has no opinion on which is better
for your volume. What both need from you, not from this repo: warmed domains,
sending policy, and consent judgment for your market.

## Triggers and glue (optional)

- **n8n:** self-hostable workflow automation. A schedule node could kick the
  pipeline weekly and post the run-log summary to your chat.
- **Make:** hosted visual automation, same idea, less infrastructure.

Useful for cadence and notifications. Not needed for any pipeline stage: the
run spine is plain `pnpm` commands a human or an agent can drive directly.

## Budget guidance

A lean stack can stay under $200/month: the Apify signal pass runs about $4
per run, Clay seats and a send tool make up the rest depending on tier. This
is planning guidance from the trial run behind this repo, not a quote, and
every price is the vendor's to set.

## The rule that survives every extension

Whatever you bolt on downstream, the approval gate stays upstream of it. No
tool on this page should ever receive a row that a human did not approve in
`pnpm agent --approve`. That is the covenant; extensions are conveniences,
not replacements.
