import { z } from "zod";
import { createHash } from "node:crypto";

const text = z.string().trim().min(1).max(2000);
const url = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//.test(s), "Use an HTTP(S) source URL");
const country = z.string().regex(/^[A-Z]{2}$/, "Use a two-letter country code");
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/^www\./, ""))
  .pipe(
    z
      .string()
      .max(253)
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
  );
export const Profile = z
  .object({
    name: text,
    offer: text,
    countries: z.array(country).min(1),
    industries: z.array(text).min(1),
    minEmployees: z.number().int().nonnegative(),
    maxEmployees: z.number().int().positive(),
    targetRoles: z.array(text).min(1),
    excludedDomains: z.array(domain).default([]),
    acceptedEmailStatuses: z
      .array(z.enum(["mx_ok", "provider_verified"]))
      .min(1)
      .default(["mx_ok", "provider_verified"]),
    maxEvidenceAgeDays: z.number().int().min(1).max(365).default(90),
    maxLeads: z.number().int().min(1).max(500).default(25),
    sources: z.array(text).min(1),
  })
  .strict()
  .refine(
    (p) => p.minEmployees <= p.maxEmployees,
    "Employee bounds are reversed",
  );
export type ProfileData = z.infer<typeof Profile>;
export const Evidence = z
  .object({
    field: z.enum([
      "company",
      "domain",
      "country",
      "industry",
      "employees",
      "contact",
      "email",
      "emailStatus",
      "signal",
      "engagement",
      "buyerRole",
    ]),
    value: text,
    status: z.enum(["observed", "buyer_stated", "inferred", "unknown"]),
    source: text,
    url,
    capturedAt: z.string().datetime(),
  })
  .strict();
export const Lead = z
  .object({
    company: text,
    domain,
    country: country.optional(),
    industry: text.optional(),
    employees: z.number().int().nonnegative().optional(),
    contact: z
      .object({
        name: text,
        role: text,
        email: z.string().email().optional(),
        emailStatus: z
          .enum(["unknown", "mx_ok", "provider_verified", "invalid"])
          .default("unknown"),
      })
      .strict()
      .optional(),
    source: text,
    evidence: z.array(Evidence).max(100),
    suppressed: z.boolean().default(false),
  })
  .strict();
export type LeadData = z.infer<typeof Lead>;
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const freshEvidence = (lead: LeadData, profile: ProfileData, now: Date) =>
  lead.evidence.filter((e) => {
    const age = now.getTime() - Date.parse(e.capturedAt);
    return (
      age >= 0 &&
      age <= profile.maxEvidenceAgeDays * 86400000 &&
      ["observed", "buyer_stated"].includes(e.status) &&
      profile.sources.some((s) => same(s, e.source))
    );
  });
export function assess(lead: LeadData, profile: ProfileData, now = new Date()) {
  const blockers: string[] = [],
    unknowns: string[] = [];
  const fresh = freshEvidence(lead, profile, now);
  const matches = (field: string, a: string, b: string) =>
    field === "domain"
      ? same(a.replace(/^www\./i, ""), b.replace(/^www\./i, ""))
      : same(a, b);
  const supported = (field: z.infer<typeof Evidence>["field"], value: string) =>
    fresh.some((e) => e.field === field && matches(field, e.value, value));
  const conflicting = (
    field: z.infer<typeof Evidence>["field"],
    value: string,
  ) => fresh.some((e) => e.field === field && !matches(field, e.value, value));
  function check(
    field: z.infer<typeof Evidence>["field"],
    value: string | undefined,
    passes: boolean,
  ) {
    if (value === undefined || !supported(field, value)) {
      unknowns.push(`${field}: evidence needed`);
      return;
    }
    if (conflicting(field, value)) {
      unknowns.push(`${field}: conflicting evidence`);
      return;
    }
    if (!passes) blockers.push(`${field}: outside profile`);
  }
  if (
    lead.suppressed ||
    profile.excludedDomains.some((d) => same(d, lead.domain))
  )
    blockers.push("suppressed domain");
  if (!profile.sources.some((s) => same(s, lead.source)))
    blockers.push("source not enabled");
  check("company", lead.company, true);
  check("domain", lead.domain, true);
  check(
    "country",
    lead.country,
    !!lead.country && profile.countries.includes(lead.country),
  );
  check(
    "industry",
    lead.industry,
    !!lead.industry && profile.industries.some((s) => same(s, lead.industry!)),
  );
  check(
    "employees",
    lead.employees?.toString(),
    lead.employees !== undefined &&
      lead.employees >= profile.minEmployees &&
      lead.employees <= profile.maxEmployees,
  );
  check(
    "contact",
    lead.contact ? `${lead.contact.name} | ${lead.contact.role}` : undefined,
    !!lead.contact &&
      profile.targetRoles.some((r) => same(r, lead.contact!.role)),
  );
  check(
    "email",
    lead.contact?.email,
    !!lead.contact &&
      profile.acceptedEmailStatuses.some(
        (s) => s === lead.contact!.emailStatus,
      ),
  );
  check("emailStatus", lead.contact?.emailStatus, true);
  for (const field of ["engagement", "buyerRole"] as const) {
    const values = new Set(
      fresh.filter((e) => e.field === field).map((e) => e.value.toLowerCase()),
    );
    if (values.size > 1) unknowns.push(`${field}: conflicting evidence`);
  }
  const status = blockers.length
    ? "rejected"
    : unknowns.length
      ? "needs_evidence"
      : "ready_for_review";
  const engaged =
    fresh.some((e) => e.field === "engagement" && e.value === "engaged") &&
    !fresh.some((e) => e.field === "engagement" && e.value !== "engaged");
  return {
    id: hash(lead),
    lead,
    status,
    blockers,
    unknowns,
    opportunity: engaged ? "engaged" : "research_only",
    nextStep:
      status === "rejected"
        ? "Exclude from this shortlist"
        : status === "needs_evidence"
          ? "Resolve the missing or conflicting evidence"
          : engaged
            ? "Confirm the buyer’s need and decision process"
            : "Review before outreach",
    buyerRole: fresh
      .filter((e) => e.field === "buyerRole")
      .map((e) => ({ value: e.value, url: e.url })),
    hypotheses: lead.evidence.filter((e) => e.status === "inferred"),
  };
}
export function buildBatch(
  profileInput: unknown,
  leadsInput: unknown,
  now = new Date(),
) {
  if (
    Buffer.byteLength(JSON.stringify([profileInput, leadsInput])) > 10_000_000
  )
    throw Error("Input exceeds 10 MB");
  const profile = Profile.parse(profileInput),
    leads = z.array(Lead).max(5000).parse(leadsInput);
  const domains = new Set<string>();
  for (const lead of leads) {
    if (domains.has(lead.domain))
      throw Error(
        `Duplicate domain: ${lead.domain}. Reconcile evidence before review.`,
      );
    domains.add(lead.domain);
  }
  const rows = leads.map((l) => assess(l, profile, now));
  return { version: 1 as const, createdAt: now.toISOString(), profile, rows };
}
export type Batch = ReturnType<typeof buildBatch>;
export const Approval = z
  .object({
    batchHash: z.string().length(64),
    reviewer: text,
    reviewedAt: z.string().datetime(),
    approvedIds: z.array(z.string().length(64)).max(500),
  })
  .strict();
export function approve(
  batch: Batch,
  ids: string[],
  reviewer: string,
  now = new Date(),
) {
  const eligible = new Set(
    batch.rows.filter((r) => r.status === "ready_for_review").map((r) => r.id),
  );
  if (
    new Set(ids).size !== ids.length ||
    ids.length > batch.profile.maxLeads ||
    ids.some((id) => !eligible.has(id))
  )
    throw Error("Approval contains blocked, duplicate, unknown or excess rows");
  return Approval.parse({
    batchHash: hash(batch),
    reviewer,
    reviewedAt: now.toISOString(),
    approvedIds: ids,
  });
}
export function exportRows(
  batch: Batch,
  approvalInput: unknown,
  now = new Date(),
) {
  const approval = Approval.parse(approvalInput);
  if (approval.batchHash !== hash(batch))
    throw Error("Batch changed after review");
  if (
    Date.parse(approval.reviewedAt) > now.getTime() ||
    Date.parse(approval.reviewedAt) < Date.parse(batch.createdAt)
  )
    throw Error("Review timestamp is outside the batch lifetime");
  approve(batch, approval.approvedIds, approval.reviewer, now);
  const refreshed = buildBatch(
    batch.profile,
    batch.rows.map((r) => r.lead),
    now,
  );
  return approval.approvedIds.map((id) => {
    const r = refreshed.rows.find((row) => row.id === id);
    if (!r || r.status !== "ready_for_review")
      throw Error(
        "Approved evidence is no longer eligible; review a fresh batch",
      );
    return {
      company: r.lead.company,
      domain: r.lead.domain,
      name: r.lead.contact!.name,
      role: r.lead.contact!.role,
      email: r.lead.contact!.email!,
      email_status: r.lead.contact!.emailStatus,
      source: r.lead.source,
      evidence_urls: [
        ...new Set(freshEvidence(r.lead, batch.profile, now).map((e) => e.url)),
      ].join(" | "),
      reviewer: approval.reviewer,
      reviewed_at: approval.reviewedAt,
    };
  });
}
