import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBatch,
  approve,
  exportRows,
  Profile,
  Lead,
} from "../src/model.js";
import { parseCsv, csvField, toCsv, importCsv } from "../src/csv.js";
const now = new Date("2026-09-20T12:00:00Z");
const profile = {
  name: "Fixture",
  offer: "Workflow implementation",
  countries: ["BR"],
  industries: ["manufacturing"],
  minEmployees: 5,
  maxEmployees: 500,
  targetRoles: ["Operations Director"],
  sources: ["custom"],
  maxLeads: 2,
};
const evidence = (field: string, value: string, status = "observed") => ({
  field,
  value,
  status,
  source: "custom",
  url: "https://fixture.example/about",
  capturedAt: now.toISOString(),
});
const lead = {
  company: "Fixture Works",
  domain: "fixture.example",
  country: "BR",
  industry: "manufacturing",
  employees: 42,
  source: "custom",
  contact: {
    name: "Sample Person",
    role: "Operations Director",
    email: "sample@fixture.example",
    emailStatus: "mx_ok",
  },
  evidence: [
    evidence("company", "Fixture Works"),
    evidence("country", "BR"),
    evidence("industry", "manufacturing"),
    evidence("employees", "42"),
    evidence("contact", "Sample Person | Operations Director"),
    evidence("email", "sample@fixture.example"),
  ],
};
lead.evidence.push(
  evidence("domain", "fixture.example"),
  evidence("emailStatus", "mx_ok"),
);
const batch = (l: unknown = lead, p: unknown = profile) =>
  buildBatch(p, [l], now);
test("custom geography, industry, source and role pass with MX-only status retained", () => {
  const b = batch();
  assert.equal(b.rows[0].status, "ready_for_review");
  assert.equal(b.rows[0].opportunity, "research_only");
  const a = approve(b, [b.rows[0].id], "Reviewer", now);
  assert.equal(exportRows(b, a, now)[0].email_status, "mx_ok");
});
test("no approval is produced by assessment", () =>
  assert.equal("approval" in batch(), false));
test("approval binds to exact content", () => {
  const b = batch(),
    a = approve(b, [b.rows[0].id], "Reviewer", now);
  b.rows[0].lead.company = "Changed";
  assert.throws(() => exportRows(b, a, now), /changed/);
});
test("export rejects missing approval", () =>
  assert.throws(() => exportRows(batch(), {}, now)));
test("unsupported claims do not pass", () =>
  assert.equal(
    batch({ ...lead, evidence: [] }).rows[0].status,
    "needs_evidence",
  ));
test("inferred claims stay separate", () => {
  const l = {
    ...lead,
    evidence: lead.evidence.map((e) => ({ ...e, status: "inferred" })),
  };
  const b = batch(l);
  assert.equal(b.rows[0].status, "needs_evidence");
  assert.equal(b.rows[0].hypotheses.length, 8);
});
test("buyer role requires evidence and is not inferred from a title", () => {
  assert.deepEqual(batch().rows[0].buyerRole, []);
  const b = batch({
    ...lead,
    evidence: [
      ...lead.evidence,
      evidence("buyerRole", "Technical evaluator", "buyer_stated"),
      evidence("engagement", "engaged", "buyer_stated"),
    ],
  });
  assert.equal(b.rows[0].opportunity, "engaged");
  assert.equal(b.rows[0].buyerRole[0].value, "Technical evaluator");
});
test("changed domain needs its own evidence", () =>
  assert.equal(
    batch({ ...lead, domain: "other.example" }).rows[0].status,
    "needs_evidence",
  ));
test("upgraded email status needs its own evidence", () =>
  assert.equal(
    batch({
      ...lead,
      contact: { ...lead.contact, emailStatus: "provider_verified" },
    }).rows[0].status,
    "needs_evidence",
  ));
test("negative engagement does not become a live opportunity", () =>
  assert.equal(
    batch({
      ...lead,
      evidence: [...lead.evidence, evidence("engagement", "not engaged")],
    }).rows[0].opportunity,
    "research_only",
  ));
test("ambiguous suppression flag cannot be dropped", () =>
  assert.throws(() =>
    importCsv(
      "company,domain,source,suppressed\nExample,example.com,custom,yes",
    ),
  ));
for (const status of ["unknown", "invalid"])
  test(`email ${status} blocks approval`, () => {
    const b = batch({
      ...lead,
      contact: { ...lead.contact, emailStatus: status },
    });
    assert.equal(b.rows[0].status, "rejected");
    assert.throws(() => approve(b, [b.rows[0].id], "Reviewer", now));
  });
test("obsolete valid email label is rejected", () =>
  assert.throws(() =>
    Lead.parse({ ...lead, contact: { ...lead.contact, emailStatus: "valid" } }),
  ));
for (const p of [
  { ...profile, countries: ["DE"] },
  { ...profile, maxEmployees: 20 },
  { ...profile, targetRoles: ["CEO"] },
  { ...profile, industries: ["software"] },
  { ...profile, excludedDomains: ["fixture.example"] },
  { ...profile, sources: ["another"] },
])
  test(`profile exclusion ${JSON.stringify(p)}`, () =>
    assert.equal(batch(lead, p).rows[0].status, "rejected"));
test("suppression cannot be approved", () => {
  const b = batch({ ...lead, suppressed: true });
  assert.throws(() => approve(b, [b.rows[0].id], "Reviewer", now));
});
test("duplicate domains stop instead of discarding contradictory evidence", () =>
  assert.throws(() => buildBatch(profile, [lead, lead], now), /Duplicate/));
test("conflicting observed evidence needs review", () =>
  assert.equal(
    batch({
      ...lead,
      evidence: [...lead.evidence, evidence("employees", "900")],
    }).rows[0].status,
    "needs_evidence",
  ));
for (const date of ["2020-01-01T00:00:00Z", "2030-01-01T00:00:00Z"])
  test(`stale or future evidence ${date}`, () =>
    assert.equal(
      batch({
        ...lead,
        evidence: lead.evidence.map((e) => ({ ...e, capturedAt: date })),
      }).rows[0].status,
      "needs_evidence",
    ));
test("freshness rechecked at export", () => {
  const b = batch(),
    a = approve(b, [b.rows[0].id], "Reviewer", now);
  assert.throws(
    () => exportRows(b, a, new Date("2027-09-20T12:00:00Z")),
    /no longer eligible/,
  );
});
test("approval has no duplicate or unknown ids", () => {
  const b = batch(),
    id = b.rows[0].id;
  assert.throws(() => approve(b, [id, id], "Reviewer", now));
  assert.throws(() => approve(b, ["a".repeat(64)], "Reviewer", now));
});
test("reversed profile bounds rejected", () =>
  assert.throws(() => Profile.parse({ ...profile, minEmployees: 600 })));
test("empty profile and unknown fields rejected", () => {
  assert.throws(() => Profile.parse({ ...profile, countries: [] }));
  assert.throws(() => Profile.parse({ ...profile, apiKey: "do-not-store" }));
});
test("non-http evidence URL rejected", () =>
  assert.throws(() =>
    batch({
      ...lead,
      evidence: [{ ...lead.evidence[0], url: "file:///etc/passwd" }],
    }),
  ));
test("multiline and quoted CSV round trip", () => {
  const r = [{ name: "Acme, Inc.", notes: 'line 1\n"line 2"' }];
  assert.deepEqual(parseCsv(toCsv(r)), r);
});
for (const s of ["=1+1", " +cmd", "@SUM(A1)", "\t=1", "-42"])
  test(`CSV formula escaped ${JSON.stringify(s)}`, () =>
    assert(csvField(s).startsWith("'")));
for (const s of ["a,a\n1,2", "a,b\n1", 'a\n"unfinished', 'a\n"ok"bad'])
  test("malformed CSV rejected", () => assert.throws(() => parseCsv(s)));
test("import does not invent evidence", () => {
  const rows = importCsv("company,domain,source\nExample,example.com,custom");
  assert.deepEqual(rows[0].evidence, []);
});
test("domain aliases share exclusions and duplicate detection across input paths", () => {
  const alias = {
    ...lead,
    domain: "WWW.fixture.example",
    evidence: lead.evidence.map((e) =>
      e.field === "domain" ? { ...e, value: "www.fixture.example" } : e,
    ),
  };
  assert.equal(batch(alias).rows[0].status, "ready_for_review");
  assert.equal(
    batch(alias, { ...profile, excludedDomains: ["fixture.example"] }).rows[0]
      .status,
    "rejected",
  );
  assert.equal(
    batch(lead, { ...profile, excludedDomains: ["www.fixture.example"] })
      .rows[0].status,
    "rejected",
  );
  assert.throws(() => buildBatch(profile, [lead, alias], now), /Duplicate/);
  const imported = importCsv(
    toCsv([
      {
        company: lead.company,
        domain: alias.domain,
        source: lead.source,
        country: lead.country,
        industry: lead.industry,
        employees: lead.employees,
        contact_name: lead.contact.name,
        contact_role: lead.contact.role,
        email: lead.contact.email,
        email_status: lead.contact.emailStatus,
        evidence_json: JSON.stringify(alias.evidence),
      },
    ]),
  );
  assert.deepEqual(buildBatch(profile, imported, now), batch(alias));
});
for (const [field, values] of [
  ["engagement", ["engaged", "not engaged"]],
  ["buyerRole", ["Evaluator", "Approver"]],
] as const)
  test(`conflicting ${field} blocks approval`, () => {
    const b = batch({
      ...lead,
      evidence: [...lead.evidence, ...values.map((v) => evidence(field, v))],
    });
    assert.equal(b.rows[0].status, "needs_evidence");
    assert.throws(() => approve(b, [b.rows[0].id], "Reviewer", now));
  });
for (const csv of [
  "company,domain,source,contact_role,email\nX,x.example,custom,Owner,a@x.example",
  "company,domain,source,contact_name\nX,x.example,custom,Sample",
  "company,domain,source,unexpected\nX,x.example,custom,value",
])
  test("CSV refuses lossy mappings", () => assert.throws(() => importCsv(csv)));
test("oversized payload is refused by shared engine", () =>
  assert.throws(() => buildBatch(profile, "x".repeat(10_000_001)), /10 MB/));
test("export excludes inference and stale source URLs", () => {
  const b = batch({
    ...lead,
    evidence: [
      ...lead.evidence,
      {
        ...evidence("signal", "Possible need", "inferred"),
        url: "https://inference.example",
      },
      {
        ...evidence("signal", "Old event"),
        capturedAt: "2020-01-01T00:00:00Z",
        url: "https://old.example",
      },
    ],
  });
  assert.equal(
    exportRows(b, approve(b, [b.rows[0].id], "Reviewer", now), now)[0]
      .evidence_urls,
    "https://fixture.example/about",
  );
});
test("review date must follow batch creation", () => {
  const b = batch(),
    a = approve(b, [b.rows[0].id], "Reviewer", now);
  assert.throws(
    () => exportRows(b, { ...a, reviewedAt: "2026-09-19T12:00:00Z" }, now),
    /timestamp/,
  );
});
