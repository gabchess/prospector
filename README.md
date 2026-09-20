# Prospector

<p align="center">
  <img src="docs/logo.svg" alt="Prospector mark" width="240" height="160">
</p>

<p align="center"><strong>A B2B lead tool for GTM engineers.</strong></p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.4.0-d4a574?labelColor=221e18" alt="version: 0.4.0"></a>
  <a href="HOST-MATRIX.md"><img src="https://img.shields.io/badge/hosts-Codex%20%C2%B7%20Claude%20Code-d4a574?labelColor=221e18" alt="hosts: Codex · Claude Code"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-d4a574?labelColor=221e18" alt="license: MIT"></a>
</p>

Research accounts with your chosen tools, then review engaged opportunities and decide the next move.

## Install

**Codex**

```sh
codex plugin marketplace add gabchess/prospector
codex plugin add prospector@prospector
```

Start a new task and select Prospector.

**Claude Code**

```sh
claude plugin marketplace add gabchess/prospector
claude plugin install prospector@prospector
```

Start a new session and use `/prospector:prospector`.

No Node installation or provider key is needed to start a conversation. Connect your own tools when research needs them. Other agents can read the [shared skill](plugins/prospector/skills/prospector/SKILL.md).

## Use it

- “Help me define a customer profile for my offer.”
- “Review this Crunchbase export and prepare a shortlist.”
- “Review this active deal and tell me what to do next.”
- “Security review has stalled. Help me plan the follow-up.”

Prospector keeps evidence, stakeholder roles, competing explanations and the next action in a private opportunity record. Later updates preserve what changed. See a [fictional case](plugins/prospector/skills/prospector/examples/opportunity.md).

You choose the sources and approve paid calls. Clay, Crunchbase and other providers need your own connection. The plugin does not include provider adapters or send outreach.

## Optional engine

The [local engine](docs/engine.md) checks supplied lead evidence and exports a shortlist after human review. It runs separately from the plugin.

[Host verification](HOST-MATRIX.md) · [Changelog](CHANGELOG.md) · [MIT license](LICENSE.md)
