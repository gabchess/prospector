import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { approve } from "../src/model.js";
import { toCsv, parseCsv } from "../src/csv.js";
test("offline CLI creates private batch, refuses overwrite and noninteractive approval", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "prospector-test-")),
    out = path.join(dir, "batch.json");
  const args = ["--import", "tsx", "src/cli.ts"];
  execFileSync(process.execPath, [
    ...args,
    "build",
    "examples/profile.json",
    "examples/leads.json",
    out,
  ]);
  assert.equal(JSON.parse(readFileSync(out, "utf8")).rows.length, 2);
  assert.notEqual(
    spawnSync(process.execPath, [
      ...args,
      "build",
      "examples/profile.json",
      "examples/leads.json",
      out,
    ]).status,
    0,
  );
  const approval = path.join(dir, "approval.json");
  const result = spawnSync(process.execPath, [
    ...args,
    "review",
    out,
    "Tester",
    approval,
  ]);
  assert.notEqual(result.status, 0);
  assert(!existsSync(approval));
});
test("CLI imports CSV and exports an approved synthetic row with private permissions", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "prospector-export-test-"));
  const profile = JSON.parse(readFileSync("examples/profile.json", "utf8"));
  const at = new Date().toISOString();
  const values = {
    company: "Fixture Works",
    domain: "fixture.example",
    country: profile.countries[0],
    industry: profile.industries[0],
    employees: String(profile.minEmployees),
    contact: `Sample Person | ${profile.targetRoles[0]}`,
    email: "sample@fixture.example",
    emailStatus: "mx_ok",
  };
  const evidence = Object.entries(values).map(([field, value]) => ({
    field,
    value,
    status: "observed",
    source: profile.sources[0],
    url: "https://fixture.example/about",
    capturedAt: at,
  }));
  const input = path.join(dir, "leads.csv"),
    batchFile = path.join(dir, "batch.json"),
    approvalFile = path.join(dir, "approval.json"),
    csv = path.join(dir, "approved.csv");
  writeFileSync(
    input,
    toCsv([
      {
        company: values.company,
        domain: values.domain,
        country: values.country,
        industry: values.industry,
        employees: values.employees,
        source: profile.sources[0],
        contact_name: "Sample Person",
        contact_role: profile.targetRoles[0],
        email: values.email,
        email_status: values.emailStatus,
        evidence_json: JSON.stringify(evidence),
      },
    ]),
    { mode: 0o600 },
  );
  const run = (...args: string[]) =>
    execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args]);
  run("build", "examples/profile.json", input, batchFile);
  const b = JSON.parse(readFileSync(batchFile, "utf8"));
  // Test-only synthetic approval. This does not stand in for a human production review.
  writeFileSync(
    approvalFile,
    JSON.stringify(approve(b, [b.rows[0].id], "Fixture reviewer")),
    { mode: 0o600 },
  );
  run("export", batchFile, approvalFile, csv);
  assert.equal(parseCsv(readFileSync(csv, "utf8"))[0].email, values.email);
  if (process.platform !== "win32")
    for (const file of [batchFile, csv])
      assert.equal(statSync(file).mode & 0o777, 0o600);
  b.rows[0].lead.company = "Changed";
  writeFileSync(batchFile, JSON.stringify(b));
  assert.throws(() =>
    run("export", batchFile, approvalFile, path.join(dir, "changed.csv")),
  );
});
