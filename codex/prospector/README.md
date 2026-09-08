# Prospector skill

Category: B2B outbound prospecting.
Headline: gated leads with evidence labels, not a guessing machine.

This skill is the chat-side door to the Prospector pipeline. It teaches an
agent how to run the engine in the installer's repo, read the gates, and stop
at the human approval gate.

## Claim ceiling

This skill documents structure and intended behavior. It proves no live run,
no lead quality, and no outcome for any ICP except the installer's own
verified runs. The 42 engine tests prove gate logic and schemas; they do not
prove a live scrape succeeds, that leads convert, that email is deliverable,
or how Clay behaves on the installer's seat.

## What the skill is

- Guidance for the run spine: set ICP, scrape, normalize, signals, Clay
  enrich, finalize, approval, export.
- The precision doctrine, mapped to real file paths in the engine.
- Downshift rules: what to do with no Apify token, no Clay seat, no agent
  host, or a CAPTCHA.
- Evidence states every lead must carry.

## What the skill is not

- Not the engine. The pipeline code lives in the repo under `src/`; nothing
  here runs without a clone of it.
- Not an email sender, sequence builder, or data marketplace.
- Not a guarantee that the installer's ICP will find leads. Gate counts vary
  by ICP and by what the sources return on a given day.
