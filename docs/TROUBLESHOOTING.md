# Troubleshooting

Symptom, cause, fix. Verbatim error messages are searchable; paste them into
your agent host if you want interpretation.

## Kill switch: CAPTCHA or block page

- **Symptom:** the Crunchbase scraper throws `KillSwitchError` with "block
  or challenge detected", or the Clutch scraper stops on a challenge page.
- **Cause:** the source served a CAPTCHA, Cloudflare challenge, or block
  page. The scrapers look for `captcha`, `hcaptcha`, `recaptcha`,
  `cdn-cgi/challenge`, and `blocked` in the page and stop on purpose.
- **Fix:** stop too. That is the design: no retry, no rotation, no other
  source. Wait, reduce frequency on your next run, or drop the source for
  this run and proceed with what you have. Never route around it; that is
  both a terms-of-service problem and how IP blocks get worse.

## Kill switch: session expired

- **Symptom:** `KillSwitchError: session expired (login/signup redirect)`.
- **Cause:** `.crunchbase.storageState.json` is stale; Crunchbase redirected
  to login.
- **Fix:** log in manually once in a browser, re-save the storage state per
  the comment at the top of `src/scrapers/crunchbase.ts`, re-run. The script
  does not sign in for you and never will.

## Null-rate abort

- **Symptom:** the Clutch scraper prints per-field null rates and refuses to
  write output.
- **Cause:** the page layout changed and the extractors are returning nulls.
  An early version of this pipeline wrote "successful" files full of nulls;
  the abort exists so that never happens silently again.
- **Fix:** check the printed null rates per field (website, country, size,
  hq). If one field collapsed, the Clutch layout moved: the extractor in
  `src/scrapers/clutch.ts` (with `clutch-dom-extract.js`) needs updating. If
  all fields collapsed, you may be looking at a soft block; treat it like the
  kill switch.

## Apify quota or token

- **Symptom:** the signal pass fails, returns nothing, or reports
  unauthorized.
- **Cause:** missing or expired `APIFY_TOKEN` in `.env`, or insufficient
  Apify credit (a run costs about $4).
- **Fix:** check `.env` against `.env.example`, top up credit, re-run only
  the signal stage. Downshift meanwhile: the pipeline runs without signals,
  rows land at tier_3 with "no verifiable signal found", and the run log
  says so.

## Clay MCP not found

- **Symptom:** your agent host cannot find Clay tools, or enrichment returns
  nothing.
- **Cause:** Clay's MCP server is not configured in that host, or the seat
  lapsed. This repo does not call Clay directly; the integration is entirely
  host-side.
- **Fix:** configure Clay's MCP server in your host and confirm your seat.
  Until then, downshift honestly: export `data/companies.csv` as "companies,
  not leads". Never fabricate contact columns. See
  [../codex/prospector/knowledge/clay-integration.md](../codex/prospector/knowledge/clay-integration.md).

## Playwright browsers missing

- **Symptom:** a scraper fails with an executable-does-not-exist error.
- **Cause:** Playwright is installed but its chromium binary is not.
- **Fix:** `npx playwright install chromium`. Note the scrapers need a headed
  browser; a headless CI box is not proven for the scrape steps (see
  [../HOST-MATRIX.md](../HOST-MATRIX.md)).

## finalize rejects rows at write time

- **Symptom:** `pnpm finalize` throws a zod validation error on a row.
- **Cause:** the Clay export is missing columns or carrying values outside
  `LeadSchema` (bad country code, empty company, malformed domain). The file
  is not written around a bad row; that is deliberate.
- **Fix:** fix the export headers (`domain`, `name`, `dm_name`, `dm_title`,
  `dm_linkedin`, `email`) and the offending values. The column contract is
  documented in
  [../codex/prospector/knowledge/clay-integration.md](../codex/prospector/knowledge/clay-integration.md).

## ICP edit broke the tests

- **Symptom:** `pnpm test` fails after editing `src/icp.ts`.
- **Cause:** a typo, an enum value the tests parse strictly, or a bound that
  contradicts another gate.
- **Fix:** this is the doctrine working: the suite parses every gate so a
  typo fails here instead of mid-scrape. Read the failing test name, fix the
  schema, re-run until green, then scrape.
