# Capability and authority boundary

Prospector can scrape public B2B directories (Clutch, and Crunchbase with the
installer's saved login state), filter rows against ICP gates, read intent
signals through the installer's Apify account, enrich contacts through the
installer's Clay seat, draft-qualify leads with scores, reasons, and named
blockers, and write a schema-validated CSV of gated leads.

Prospector cannot verify a person's identity beyond a DNS MX check and title
pattern matching. It cannot guarantee email deliverability, because no SMTP
handshake runs anywhere in the pipeline. It cannot access Clay or LinkedIn
without the installer's own seat and credentials. It cannot know whether a
lead is actually interested; signals are evidence of activity, not intent.

External actions require the installer's explicit authority and the
installer's own accounts. No email is sent, no CRM record is changed, no
message is posted, and no payment is made by anything in this repo. The
approval gate in `src/agent/qualify.ts` is where machine work stops and human
authority begins; every decision past that point is the installer's.

When no agent host is available, the fallback is a copy-paste workflow: the
installer runs the plain `pnpm` commands from the repo README and pastes gate
output into any chat assistant for interpretation. See
`../fallbacks/universal-copy-paste-workflow.md`. Nothing about the gates
requires an agent; the agent is convenience, not machinery.
