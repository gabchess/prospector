# Degraded-capability operation

When inputs, keys, seats, or sources are missing, downshift and label. The
ladder, from least to most degraded:

1. **No Apify token.** Scrape and filter still run. Signals fall to
   `no verifiable signal found`, rows land at tier_3 at best, and scoring
   adds the "no intent signal" blocker. Say it in the run log and in the
   hand-off. Do not present tier_3-by-missing-key as tier_3-by-weak-signal.
2. **No Clay seat.** Companies without contacts. Export
   `data/companies.csv` labeled "companies, not leads". Never guess emails or
   titles. See `examples/no-clay-downshift.md`.
3. **No Crunchbase login state.** Clutch alone works. The trial run shipped
   71 of 100 rows from Clutch; one source is a complete run, not a failure.
4. **No agent host.** Plain `pnpm` commands per the repo README, plus
   `fallbacks/universal-copy-paste-workflow.md` for interpretation. Nothing
   in the gates requires an agent.
5. **CAPTCHA, block page, or login redirect.** Full stop. The kill switches
   in `src/scrapers/crunchbase.ts` and `src/scrapers/clutch.ts` throw on
   purpose. Report what fired, wait for a human, and never retry past a
   block, rotate proxies, or switch to an undocumented source.
6. **Null-rate abort.** The Clutch scraper's null-rate check fired: the
   source layout probably changed. Report the per-field null rates the
   scraper printed and stop. This is the pipeline protecting the installer
   from a clean run full of empty rows.

Rules that hold at every rung:

- Degraded output is labeled degraded, in the file hand-off and the run log.
- No email status is ever upgraded. `no_mx` stays `no_mx`.
- Counts stay honest. A degraded run that found 61 companies is reported as
  61 companies, not rounded up to "leads".
