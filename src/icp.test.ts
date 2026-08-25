import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CompanySchema, LeadSchema } from "./icp.js";
import { readCsv } from "./pipeline/csv.js";

describe("CompanySchema", () => {
  it("accepts a company inside the ICP", () => {
    const result = CompanySchema.safeParse({
      name: "Acme Outbound",
      domain: "acmeoutbound.com",
      country: "US",
      headcount: 42,
      company_type: "lead_gen_agency",
      arr_estimate_usd: 2_000_000,
      source: "crunchbase",
    });
    expect(result.success).toBe(true);
  });

  it("rejects headcount outside 11-200", () => {
    const result = CompanySchema.safeParse({
      name: "TooBig Inc",
      domain: "toobig.com",
      country: "US",
      headcount: 5000,
      company_type: "b2b_saas",
      source: "crunchbase",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a domain with www or protocol", () => {
    const result = CompanySchema.safeParse({
      name: "Bad Domain Co",
      domain: "https://www.baddomain.com",
      country: "US",
      headcount: 30,
      company_type: "b2b_saas",
      source: "clutch",
    });
    expect(result.success).toBe(false);
  });
});

describe("LeadSchema", () => {
  const baseLead = {
    company: "Acme Outbound",
    domain: "acmeoutbound.com",
    country: "US",
    headcount: "10 - 49",
    company_type: "lead_gen_agency",
    decision_maker_name: "Jamie Rivera",
    decision_maker_title: "VP Sales",
    decision_maker_linkedin: "https://www.linkedin.com/in/jamie-rivera/",
    sales_owner_title: "VP Sales",
    email: "jamie@acmeoutbound.com",
    email_status: "mx_ok",
    signal_tier: "tier_1",
    signal_type: "hiring",
    signal_evidence: "SDR role posted 2026-08-10",
    signal_url: "https://www.linkedin.com/jobs/view/1234",
    source: "clutch",
    origin_url: "https://clutch.co/profile/acme-outbound",
    captured_at: "2026-08-22T17:28:58.550Z",
  };

  // No lead list ships in this repo (lead data is personal data; see data/README.md).
  // When a generated data/leads_final.csv exists locally, every row must parse.
  it("accepts every row in a locally generated data/leads_final.csv", async () => {
    const file = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../data/leads_final.csv",
    );
    if (!existsSync(file)) return; // fresh clone: nothing generated yet
    const rows = await readCsv(file);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const result = LeadSchema.safeParse(row);
      expect(
        result.success,
        `${row.company}: ${JSON.stringify(result.error?.issues)}`,
      ).toBe(true);
    }
  });

  it("rejects a tier_1 row with no evidence URL", () => {
    const result = LeadSchema.safeParse({ ...baseLead, signal_url: "" });
    expect(result.success).toBe(false);
  });

  it("has no way to claim an SMTP-verified email", () => {
    const result = LeadSchema.safeParse({ ...baseLead, email_status: "valid" });
    expect(result.success).toBe(false);
  });
});
