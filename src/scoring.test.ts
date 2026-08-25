import { describe, expect, it } from "vitest";
import { scoreLead, type ScoreInput } from "./scoring.js";

const inIcp: ScoreInput["company"] = {
  name: "Acme Outbound",
  domain: "acmeoutbound.com",
  country: "US",
  headcount: 42,
  company_type: "lead_gen_agency",
};

const bothSignals = { hiring_signal: true, post_signal: true };

describe("scoreLead blockers", () => {
  it("gives a perfect lead 100 and no blockers", () => {
    const r = scoreLead({
      company: inIcp,
      signals: bothSignals,
      decision_maker_title: "VP Sales",
      has_vp_sales: true,
      email_status: "valid",
    });
    expect(r.score).toBe(100);
    expect(r.qualified).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("blocks a company with no VP of Sales even when everything else is perfect", () => {
    const r = scoreLead({
      company: inIcp,
      signals: bothSignals,
      decision_maker_title: "VP Sales",
      has_vp_sales: false,
      email_status: "valid",
    });
    expect(r.qualified).toBe(false);
    expect(r.blockers.some((b) => b.includes("VP of Sales"))).toBe(true);
  });

  it("blocks a lead with no intent signal in the window", () => {
    const r = scoreLead({
      company: inIcp,
      signals: { hiring_signal: false, post_signal: false },
      has_vp_sales: true,
      email_status: "valid",
    });
    expect(r.qualified).toBe(false);
    expect(r.blockers.some((b) => b.includes("intent signal"))).toBe(true);
  });

  it("blocks headcount above the 200 ceiling", () => {
    const r = scoreLead({
      company: { ...inIcp, headcount: 201 },
      signals: bothSignals,
      has_vp_sales: true,
      email_status: "valid",
    });
    expect(r.blockers.some((b) => b.includes("11-200"))).toBe(true);
  });

  it("blocks a country outside the four ICP markets", () => {
    const r = scoreLead({
      company: { ...inIcp, country: "BR" as never },
      signals: bothSignals,
      has_vp_sales: true,
      email_status: "valid",
    });
    expect(r.blockers.some((b) => b.includes("US/UK/CA/AU"))).toBe(true);
  });

  it("blocks an email that is not verified valid", () => {
    const r = scoreLead({
      company: inIcp,
      signals: bothSignals,
      has_vp_sales: true,
      email_status: "risky",
    });
    expect(r.qualified).toBe(false);
    expect(r.blockers.some((b) => b.includes("risky"))).toBe(true);
  });
});

describe("scoreLead grading", () => {
  it("scores one signal below two signals", () => {
    const base = {
      company: inIcp,
      has_vp_sales: true,
      email_status: "valid",
    } as const;
    const one = scoreLead({
      ...base,
      signals: { hiring_signal: true, post_signal: false },
    });
    const two = scoreLead({ ...base, signals: bothSignals });
    expect(one.score).toBeLessThan(two.score);
    expect(two.reasons.some((r) => r.includes("signal stacking"))).toBe(true);
  });

  it("gives RevOps Manager a reason but not the seniority points", () => {
    const base = {
      company: inIcp,
      signals: bothSignals,
      has_vp_sales: true,
      email_status: "valid",
    } as const;
    const revops = scoreLead({
      ...base,
      decision_maker_title: "RevOps Manager",
    });
    const ceo = scoreLead({ ...base, decision_maker_title: "CEO" });
    expect(revops.score).toBeLessThan(ceo.score);
    expect(revops.reasons.some((r) => r.includes("internal champion"))).toBe(
      true,
    );
  });

  it("keeps a near miss visible instead of collapsing it to zero", () => {
    // Blocked on the VP rule only. The signal points still show, so the log
    // records how close the lead was rather than a bare zero.
    const r = scoreLead({
      company: inIcp,
      signals: bothSignals,
      has_vp_sales: false,
      email_status: "valid",
    });
    expect(r.qualified).toBe(false);
    expect(r.score).toBeGreaterThan(0);
  });
});
