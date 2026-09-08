# Provenance

## Origin

Prospector was extracted from a production GTM trial run, August 2026. That run
shipped 100 leads against one ICP; every email was backed by a live DNS MX
record, and every row passed one human approval gate before it shipped. No lead
data ships in this repo: lead lists are personal data, so installers generate
their own against their own ICP (see [data/README.md](data/README.md)).

## Envelope pattern

Envelope pattern studied from Victor Lane v0.1.3 envelope, implemented
independently, no content copied.

## Byte-preserved vs authored integration

Byte-preserved from the trial-run codebase:

- The `src/` engine: ICP schemas, Clutch and Crunchbase scrapers, normalize,
  finalize, scoring, the MCP server, the qualify agent, and their tests.
- `.claude/skills/onboard/SKILL.md`.
- `data/sample-companies.csv`, three fictional rows. One company was renamed in
  0.2.0 to keep an internal codename out of fixture data; the row shape is
  unchanged.

Authored for the 0.2.0 augment cut:

- The codex skill tree at `codex/prospector/` and the claude zip at
  `claude/prospector-v0.2.0.zip`, plus `scripts/build_zip.mjs`.
- The `docs/` suite, `LICENSE-STATUS.md`, `CHANGELOG.md`, the
  T-NOVA one-pager, and the 0.2.0 upgrades to `START-HERE.md`,
  `HOST-MATRIX.md`, and `README.md`.
- `scripts/gen_manifests.mjs`, the two manifests, and the manifest drift test.

## Fixtures

`data/sample-companies.csv` is the only data fixture. All three rows are
fictional: acmeoutbound.example, harborgrowth.example, beaconsales.example.
Every walkthrough in `codex/prospector/examples/` uses these rows only, and
each is labeled a fixture.
