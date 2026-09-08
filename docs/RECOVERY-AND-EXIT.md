# Recovery and exit

## Reset a run

Every stage reads and writes plain files, so recovery is file management:

```bash
rm data/companies.csv data/companies_signals.csv data/leads_final.csv
rm data/agent-log.jsonl data/pending-approval.json
rm -rf data/raw
```

That clears every generated output and returns the repo to fresh-clone state
(the tracked files `data/README.md` and `data/sample-companies.csv` stay).

## Re-run from any stage

Stages are ordered but independent; re-enter wherever the bad stage was:

| You want to redo | Delete | Re-run |
|---|---|---|
| Scrape only | `data/raw/` | `pnpm scrape:clutch` (and/or `pnpm scrape:crunchbase`), then everything downstream |
| Gates only | `data/companies.csv` | `pnpm normalize` and downstream |
| Signals only | `data/companies_signals.csv` | the Apify pass, then `pnpm finalize ...` |
| Enrichment only | the Clay export file | re-export from Clay, then `pnpm finalize path/to/clay-export.csv` |
| Approval only | `data/pending-approval.json` | `pnpm agent`, then `pnpm agent --approve` |

`pnpm finalize` preserves `captured_at` from an existing
`data/leads_final.csv` when present, so re-finalizing does not launder old
rows into looking freshly captured.

## After a kill switch

A CAPTCHA or block ends the run by design. Recovery is a human decision:
wait and retry later at lower volume, re-save the Crunchbase login state if
it expired, or finish the run with the sources you have. The partial outputs
already on disk are valid inputs to the next stage; nothing is corrupted by
a kill switch, because it throws before writing.

## Uninstall

- **Skill:** delete the folder you copied into your host's skill root
  (`codex/prospector/` tree, or the unpacked zip). No registry entries, no
  background processes, no config left behind in this repo's name.
- **Engine:** delete your clone. Remove your `APIFY_TOKEN` from the deleted
  `.env`, and revoke it in your Apify console if the clone lived anywhere
  shared. Delete your saved `.crunchbase.storageState.json` and log out of
  that Crunchbase session.
- **Clay:** remove Clay's MCP server from your host config and delete any
  Clay tables holding your lead data. Both live entirely on your side.
- **Data:** your generated lead CSVs die with the clone unless you exported
  them. That is the point: leads are personal data, and the exit path leaves
  no copy behind that you did not deliberately keep.
