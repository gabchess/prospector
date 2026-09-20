# Profile and lead contract

Profile fields: `name`, `offer`, `countries` (two-letter uppercase codes), `industries`, `minEmployees`, `maxEmployees`, `targetRoles`, `sources`. Optional defaults: `excludedDomains: []`, `maxLeads: 25`, `maxEvidenceAgeDays: 90`, `acceptedEmailStatuses: ["mx_ok", "provider_verified"]`.

Lists use exact case-insensitive matches except country codes. Configure the user's terms explicitly. An empty list does not mean all. No credentials or paid-provider budgets belong in this public example or the engine profile; keep a separate private run record of authorized calls, spending and results.

A JSON lead has:

```json
{
  "company": "Example Works",
  "domain": "example.com",
  "country": "BR",
  "industry": "manufacturing",
  "employees": 42,
  "source": "manual",
  "contact": {
    "name": "Sample Person",
    "role": "Operations Director",
    "email": "sample@example.com",
    "emailStatus": "unknown"
  },
  "evidence": [],
  "suppressed": false
}
```

This fictional shape is incomplete and cannot pass review. A source record contains `field`, `value`, `status`, `source`, `url` and `capturedAt` (UTC ISO timestamp). Supported fields: company, domain, country, industry, employees, contact, email, emailStatus, signal, engagement, buyerRole. Status: observed, buyer_stated, inferred or unknown.

Evidence for each required field must be fresh, from an enabled source, and match the value. Employees use a numeric string. Contact evidence uses `Name | Role`. Email evidence uses the returned address; emailStatus evidence must separately match the claimed status. Preserve the provider's verification detail in the private source record. An `emailStatus` is an input claim, not a check performed by this engine. Use `mx_ok` only after an actual MX check, `provider_verified` only with that provider result, `invalid` for a failed check, otherwise `unknown`. Use engagement value `engaged` only when a source supports actual buyer engagement.

Fresh conflicting observations require resolution. Inferences are retained separately and cannot satisfy a required check. Sources remain attributable in the export. A known suppressed domain always fails.

Domains are lowercased and their leading `www.` is removed across JSON, CSV and MCP, including exclusions. Other subdomains remain distinct. Conflicting engagement or buyer-role records also need resolution. These optional fields cannot establish a qualified sales opportunity. Exported evidence URLs include only fresh observations from enabled sources; the private batch retains the full evidence record.

CSV imports use: company, domain, country, industry, employees, source, contact_name, contact_role, email, email_status, evidence_json, suppressed. `evidence_json` contains the JSON evidence array, escaped as a CSV cell. JSON is simpler for nested evidence. Adapting a provider export must retain its meaning and source; do not fabricate observation records from a company list.

Unknown CSV columns and partial contact groups are rejected. Any supplied contact field requires both name and role. The engine rejects inputs over 10 MB after receipt; the local MCP host must also bound transport size and process memory.

Batch states: rejected, needs_evidence or ready_for_review. None means human-approved. The CLI review records approved row hashes against the exact batch hash. Export rechecks eligibility and freshness. Keep batch, approval and CSV together in a private workspace. Files use exclusive creation and restrictive permissions; use new output paths for each run.
