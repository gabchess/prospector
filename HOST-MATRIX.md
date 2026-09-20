# Host verification

| Surface | Included | Verification |
| --- | --- | --- |
| Local CLI | Profile checks, review and export | 55 offline tests passed, including package checks; fictional data |
| MCP | Read-only lead assessment over stdio | Real local client/server test |
| Codex | Marketplace and shared skill | Native local marketplace install passed. A fresh task read the installed skill and produced a synthetic case and unsent draft; an explicit-path retest checked evidence states. Automatic discovery across other setups is untested. |
| Claude Code | Marketplace and shared skill | Native validation, install and one-skill inventory passed. Live invocation is blocked by the test machine's expired OAuth session. |
| Other agents | Markdown guidance and CLI/MCP | Requires compatible host; not individually tested |
| Clay, Crunchbase, custom providers | Setup guidance and common input contract | User-configured connection; live paid calls not tested |

Structural checks do not prove provider availability or lead quality. No outreach path exists. Private approval files need OS-level access control; an agent with unrestricted filesystem access is not sandboxed by this workflow.

The Codex build suffix identifies a local cache refresh; the base release version must match the package and Claude manifest. Tests accept only the documented timestamp suffix.

The synthetic Codex test retained unknown budget and authority, ignored an instruction embedded in source notes, and proposed a bounded next step without external action. This is one scenario, not a guarantee. The first run exposed an unsupported-versus-disconfirmed classification error; the rule was corrected and the repeat passed.
