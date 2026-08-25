# data/

Pipeline outputs land here. Nothing real ships in this repo: lead lists are personal
data, so you generate your own against your own ICP.

- `companies.csv` - written by `pnpm normalize`
- `companies_signals.csv` - written by the signal pass
- `leads_final.csv` - written by `pnpm finalize`

`sample-companies.csv` holds three FICTIONAL rows so `pnpm agent` has something to
read on a fresh clone. Replace it with a real scrape before trusting any output.
