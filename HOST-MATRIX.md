# Host verification

| Surface | Included | Verification |
| --- | --- | --- |
| Local CLI | Profile checks, review and export | Offline tests, fictional data |
| MCP | Read-only lead assessment over stdio | Real local client/server test |
| Codex | Shared skill and plugin manifest | Manifest and skill validation; fresh-host activation pending |
| Claude Code | Shared skill and plugin manifest | Manifest validation passed; activation test blocked by expired local OAuth session |
| Other agents | Markdown guidance and CLI/MCP | Requires compatible host; not individually tested |
| Clay, Crunchbase, custom providers | Setup guidance and common input contract | User-configured connection; live paid calls not tested |

Structural checks do not prove provider availability or lead quality. No outreach path exists. Private approval files need OS-level access control; an agent with unrestricted filesystem access is not sandboxed by this workflow.
