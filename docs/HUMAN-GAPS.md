# Human gaps

What still needs a person, and why each gap exists on purpose. None of these
are roadmap items; they are the design.

## ICP judgment

**The gap.** Deciding that your customer is "11-200 person B2B agencies in
US/UK/CA/AU with ARR under $20M" is a business bet, not a schema edit. The
machine enforces whatever gates you write; it cannot tell you they are the
right gates.

**Why a human.** The trial run behind this repo measured its source before
trusting it (a 300-company Crunchbase scrape showed 74% had raised past the
revenue ceiling) and changed the ICP strategy on that evidence. Reading your
own numbers that way, and betting on an ICP, is judgment with skin in the
game. `src/icp.ts` is where that judgment lands as code, and `pnpm test` is
where a typo in it dies.

## The qualified mark

**The gap.** No lead becomes qualified until a person walks
`data/pending-approval.json` with `pnpm agent --approve`. The agent scores,
sorts, and presents; it never decides.

**Why a human.** Scores rank evidence; they do not carry consequences. A
human approving a row attaches a name to "we may contact this person", which
is what makes the list defensible when someone asks why a contact got mail.
The gate in `src/agent/qualify.ts` is the product, not a demo step.

## Send decisions

**The gap.** Everything after `data/leads_final.csv`: whether to send at
all, with what tool, what copy, from which domains, at what volume.

**Why a human.** Sending touches real people's inboxes, your domain
reputation, and the law in your market. This repo deliberately contains no
send path, so the decision cannot be automated by accident. Tools and
guidance for that side live in
[EXTEND-YOUR-STACK.md](EXTEND-YOUR-STACK.md), all installer-side choices.

## Clay seat management

**The gap.** Owning the Clay subscription, configuring its MCP server in
your host, choosing enrichment columns, and deciding what to do when Clay is
down.

**Why a human.** It is your agreement with Clay, your spend, and your data
processing. The pipeline consumes a Clay export CSV and nothing more; when
Clay is unavailable the human decides between waiting and shipping
"companies, not leads" (see
[../codex/prospector/knowledge/clay-integration.md](../codex/prospector/knowledge/clay-integration.md)).

## CAPTCHA and block judgment calls

**The gap.** A kill switch fired. Wait? Slow down? Drop the source? Re-save
the login state? The scraper will not choose.

**Why a human.** The scrapers in `src/scrapers/` throw on CAPTCHA, block
pages, and login redirects with no retry and no rotation, because routing
around a wall is a terms-of-service violation and an escalation spiral. Only
a person can weigh patience against budget against source value, and only a
person should decide to give up on a source for the run.

## Edge-case reading

**The gap.** `mx_ok_role_account` rows, ambiguous headcount bands, odd titles
that passed `ownsSales`, near-misses in the log. The machine flags; it does
not adjudicate.

**Why a human.** Flags are questions, and the answers depend on your offer
and your market: a shared inbox may be fine for an agency ICP and useless for
an enterprise one. The precision-doctrine checklist in
[../codex/prospector/knowledge/precision-doctrine.md](../codex/prospector/knowledge/precision-doctrine.md)
is written for the person making those calls.
