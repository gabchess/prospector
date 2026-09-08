# Example: no Clay seat, companies not leads

FIXTURE. Uses the three fictional rows from `data/sample-companies.csv`.

## The situation

The installer has a repo clone and an Apify token but no Clay seat. They ask
for leads anyway.

## What the skill does

Downshift, honestly labeled:

```bash
pnpm scrape:clutch          # or reuse the sample CSV for a dry run
pnpm normalize              # writes data/companies.csv, gates applied
# signals pass via Apify if the token is set; writes data/companies_signals.csv
```

No `pnpm finalize`: finalize joins the Clay export, and there is no Clay
export. No `pnpm agent --approve` walk either, because without titles no row
can clear the sales-owner check downstream.

## What ships

`data/companies.csv`: company names, domains, countries, headcount bands
with ambiguity flags, categories, sources. The hand-off message labels it
exactly: "companies, not leads. No contact columns, because no Clay seat.
Every row passed the geo, headcount, and type gates."

## What the skill refuses to do

- Guess emails from domain patterns (first@, hello@) and present them as
  leads.
- Pull titles from a search engine and call it enrichment.
- Mark anything qualified. The approval gate has nothing to approve.

## The upgrade path

One sentence for the installer: add Clay's MCP server to your host and a Clay
seat, then the same `data/companies.csv` feeds the enrichment table, and
`pnpm finalize path/to/clay-export.csv` picks up where this stopped. See
`../knowledge/clay-integration.md`.
