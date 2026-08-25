import { describe, expect, it } from "vitest";
import {
  clutchCategoryToType,
  dedupeByDomain,
  inferCompanyType,
  isClearlyOutsideIcp,
  normalizeClutchRow,
  normalizeCrunchbaseRow,
  normalizeDomain,
  parseFundingUsd,
  parseHeadcountBand,
  type NormalizedRow,
} from "./normalize.js";

describe("normalizeDomain", () => {
  it("strips www and protocol", () => {
    expect(normalizeDomain("https://www.Acme.com/path")).toBe("acme.com");
  });

  it("returns empty for clutch hosts", () => {
    expect(normalizeDomain("https://r.clutch.co/redirect?u=x")).toBe("");
  });
});

describe("parseHeadcountBand", () => {
  it("flags 10 - 49 as ambiguous because 10 is below the ICP floor", () => {
    const band = parseHeadcountBand("10 - 49");
    expect(band).toMatchObject({ low: 10, high: 49, ambiguous: true });
    expect(isClearlyOutsideIcp(band!)).toBe(false);
  });

  it("flags 50 - 249 as ambiguous because 249 is above the ICP ceiling", () => {
    const band = parseHeadcountBand("50 - 249");
    expect(band).toMatchObject({ low: 50, high: 249, ambiguous: true });
    expect(isClearlyOutsideIcp(band!)).toBe(false);
  });

  it("flags 101-250 as ambiguous", () => {
    const band = parseHeadcountBand("101-250");
    expect(band).toMatchObject({ low: 101, high: 250, ambiguous: true });
  });

  it("keeps 11-50 inside the ICP without guessing a midpoint", () => {
    const band = parseHeadcountBand("11-50");
    expect(band).toMatchObject({ low: 11, high: 50, ambiguous: false });
  });

  it("drops 2 - 9 as clearly below 11", () => {
    expect(isClearlyOutsideIcp(parseHeadcountBand("2 - 9")!)).toBe(true);
  });

  it("drops 250 - 999 as clearly above 200", () => {
    expect(isClearlyOutsideIcp(parseHeadcountBand("250 - 999")!)).toBe(true);
  });
});

describe("company type", () => {
  it("maps clutch_category onto the ICP enum", () => {
    expect(clutchCategoryToType("digital-marketing")).toBe("digital_marketing_agency");
    expect(clutchCategoryToType("lead-generation")).toBe("lead_gen_agency");
    expect(clutchCategoryToType("sales-outsourcing")).toBe("sales_consulting");
  });

  it("maps Crunchbase industry or returns null", () => {
    expect(inferCompanyType("SaaS; B2B")).toBe("b2b_saas");
    expect(inferCompanyType("Artificial Intelligence (AI); Infrastructure")).toBe(null);
  });
});

describe("normalize rows", () => {
  it("keeps a clutch row without website and marks needs_domain_lookup", () => {
    const row = normalizeClutchRow({
      name: "SalesRoads",
      website: null,
      size: "10 - 49",
      country: "US",
      clutch_category: "lead-generation",
      origin_url: "https://clutch.co/profile/salesroads",
    });
    expect(row).toMatchObject({
      domain: "",
      needs_domain_lookup: true,
      headcount: null,
      headcount_ambiguous: true,
      country: "US",
      company_type: "lead_gen_agency",
    });
  });

  it("drops a clutch row with null country", () => {
    expect(
      normalizeClutchRow({
        name: "No Geo",
        website: "nogeo.com",
        size: "10 - 49",
        country: null,
        clutch_category: "lead-generation",
        origin_url: "https://clutch.co/profile/nogeo",
      }),
    ).toBeNull();
  });

  it("drops Crunchbase rows whose industry is not an ICP type", () => {
    expect(
      normalizeCrunchbaseRow({
        name: "Fireworks AI",
        domain: "fireworks.ai",
        country: "US",
        headcount: "101-250",
        industry: "Artificial Intelligence (AI); Infrastructure",
        origin_url: "https://www.crunchbase.com/organization/fireworks-ai",
      }),
    ).toBeNull();
  });
});

describe("dedupeByDomain", () => {
  const base: NormalizedRow = {
    name: "Acme",
    domain: "acme.com",
    country: "US",
    headcount: 11,
    headcount_raw: "11-50",
    headcount_low_edge: 11,
    headcount_high_edge: 50,
    headcount_ambiguous: false,
    needs_domain_lookup: false,
    company_type: "b2b_saas",
    funding_usd: null,
    source: "clutch",
    origin_url: "https://clutch.co/profile/acme",
  };

  it("keeps the first domain and does not drop domain-less rows", () => {
    const out = dedupeByDomain([
      base,
      { ...base, name: "Acme Dup", source: "crunchbase", origin_url: "https://www.crunchbase.com/organization/acme" },
      {
        ...base,
        name: "No Site Co",
        domain: "",
        needs_domain_lookup: true,
        origin_url: "https://clutch.co/profile/nosite",
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out.filter((r) => r.domain === "acme.com")).toHaveLength(1);
    expect(out.some((r) => r.needs_domain_lookup)).toBe(true);
  });
});

describe("parseFundingUsd", () => {
  it("parses the Crunchbase $amount string", () => {
    expect(parseFundingUsd("$19500000")).toBe(19_500_000);
    expect(parseFundingUsd("$1832000000")).toBe(1_832_000_000);
    expect(parseFundingUsd(null)).toBeNull();
  });

  it("drops a Crunchbase row funded above $20M and keeps one at or below", () => {
    const over = normalizeCrunchbaseRow({
      name: "Too Funded",
      domain: "toofunded.com",
      country: "US",
      headcount: "11-50",
      industry: "SaaS",
      funding: "$21000000",
      origin_url: "https://www.crunchbase.com/organization/too-funded",
    });
    const ok = normalizeCrunchbaseRow({
      name: "Right Size",
      domain: "rightsize.com",
      country: "US",
      headcount: "11-50",
      industry: "SaaS",
      funding: "$19500000",
      origin_url: "https://www.crunchbase.com/organization/right-size",
    });
    const unknown = normalizeCrunchbaseRow({
      name: "No Raise",
      domain: "noraise.com",
      country: "US",
      headcount: "11-50",
      industry: "SaaS",
      funding: null,
      origin_url: "https://www.crunchbase.com/organization/no-raise",
    });
    expect(over).toBeNull();
    expect(ok).toMatchObject({ funding_usd: 19_500_000, domain: "rightsize.com" });
    expect(unknown).toMatchObject({ funding_usd: null, domain: "noraise.com" });
  });

  it("leaves clutch funding_usd null", () => {
    const row = normalizeClutchRow({
      name: "SalesRoads",
      website: "salesroads.com",
      size: "10 - 49",
      country: "US",
      clutch_category: "lead-generation",
      origin_url: "https://clutch.co/profile/salesroads",
    });
    expect(row?.funding_usd).toBeNull();
  });
});
