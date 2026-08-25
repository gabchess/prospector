import {
  CompanyTypeSchema,
  CountrySchema,
  DecisionMakerTitleSchema,
  type Company,
  type Signals,
} from "./icp.js";

/**
 * Graded ICP scoring, separate from the binary gate in icp.ts.
 *
 * icp.ts answers "is this row shaped like a valid lead?" (schema validity).
 * This file answers "how good is this lead, and why?" (ranking + audit trail).
 * Both are needed: the schema keeps malformed rows out of the CSV, the score
 * decides which 100 of the qualified rows actually ship.
 */

export type ScoreInput = {
  company: Pick<
    Company,
    "name" | "domain" | "country" | "headcount" | "company_type"
  >;
  signals?: Pick<
    Signals,
    "hiring_signal" | "post_signal" | "signal_url"
  > | null;
  decision_maker_title?: string | null;
  has_vp_sales?: boolean | null;
  email_status?: string | null;
};

export type ScoreResult = {
  score: number;
  qualified: boolean;
  reasons: string[];
  blockers: string[];
};

/** Weights sum to 100 when every component is present. Kept explicit so the
 * reasons and blockers in the output show why a lead scored what it scored. */
const WEIGHTS = {
  inIcpBase: 40,
  hiringSignal: 20,
  postSignal: 20,
  bothSignalsBonus: 10,
  seniorTitle: 10,
} as const;

/** Titles that clear budget on a deliverability tool without an internal
 * champion. RevOps Manager sits in the ICP but does not clear budget alone,
 * so it earns the reason line without the points. */
const SENIOR_TITLES = new Set([
  "Founder",
  "CEO",
  "Head of Sales",
  "VP Sales",
  "Head of Growth",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreLead(input: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const { company, signals } = input;

  // Hard gates first. Any blocker disqualifies regardless of the number.
  if (!CountrySchema.safeParse(company.country).success) {
    blockers.push(`country ${String(company.country)} is outside US/UK/CA/AU`);
  }
  if (!CompanyTypeSchema.safeParse(company.company_type).success) {
    blockers.push(
      `company_type ${String(company.company_type)} is outside the ICP`,
    );
  }
  if (
    typeof company.headcount !== "number" ||
    !Number.isInteger(company.headcount) ||
    company.headcount < 11 ||
    company.headcount > 200
  ) {
    blockers.push(`headcount ${String(company.headcount)} is outside 11-200`);
  }
  if (input.has_vp_sales !== true) {
    blockers.push("no VP of Sales found (hard disqualifier in the ICP)");
  }
  if (input.email_status != null && input.email_status !== "valid") {
    blockers.push(`email_status is ${input.email_status}, not valid`);
  }

  const hasHiring = signals?.hiring_signal === true;
  const hasPost = signals?.post_signal === true;
  if (!hasHiring && !hasPost) {
    blockers.push("no intent signal in the window (needs hiring or post)");
  }

  // Graded score. Computed even when blocked, so a near miss stays visible in
  // the log instead of collapsing to a bare zero.
  let score = 0;
  if (blockers.length === 0) {
    score += WEIGHTS.inIcpBase;
    reasons.push(
      `in ICP: ${company.company_type}, ${company.headcount} people, ${company.country}`,
    );
  }
  if (hasHiring) {
    score += WEIGHTS.hiringSignal;
    reasons.push(
      "hiring signal: SDR/BDR/growth role opened in the last 30 days",
    );
  }
  if (hasPost) {
    score += WEIGHTS.postSignal;
    reasons.push(
      "post signal: leadership posted about cold email or deliverability",
    );
  }
  if (hasHiring && hasPost) {
    score += WEIGHTS.bothSignalsBonus;
    reasons.push("signal stacking: both signals present, higher priority");
  }
  const title = input.decision_maker_title;
  if (title != null && DecisionMakerTitleSchema.safeParse(title).success) {
    if (SENIOR_TITLES.has(title)) {
      score += WEIGHTS.seniorTitle;
      reasons.push(`decision maker ${title} can approve budget directly`);
    } else {
      reasons.push(
        `decision maker ${title} is in the ICP but needs an internal champion`,
      );
    }
  }

  return {
    score: clamp(score, 0, 100),
    qualified: blockers.length === 0,
    reasons,
    blockers,
  };
}
