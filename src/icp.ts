import { z } from "zod";

export const CompanyTypeSchema = z.enum([
  "b2b_saas",
  "digital_marketing_agency",
  "lead_gen_agency",
  "sales_consulting",
]);

export const CountrySchema = z.enum(["US", "UK", "CA", "AU"]);

export const DecisionMakerTitleSchema = z.enum([
  "Founder",
  "CEO",
  "Head of Sales",
  "VP Sales",
  "Head of Growth",
  "RevOps Manager",
]);

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

export const CompanySchema = z.object({
  name: z.string().min(1),
  domain: z
    .string()
    .regex(DOMAIN_RE, "domain must be lowercase, no www, no protocol"),
  country: CountrySchema,
  headcount: z.number().int().min(11).max(200),
  company_type: CompanyTypeSchema,
  arr_estimate_usd: z.number().min(500_000).max(20_000_000).optional(),
  source: z.enum(["crunchbase", "clutch"]),
});
export type Company = z.infer<typeof CompanySchema>;

export const SignalsSchema = z.object({
  domain: z.string(),
  hiring_signal: z.boolean(),
  post_signal: z.boolean(),
  signal_url: z.string().url().optional(),
});
export type Signals = z.infer<typeof SignalsSchema>;

const Url = z.string().url();
const UrlOrEmpty = z.union([Url, z.literal("")]);

/** One shipped row of data/leads_final.csv. finalize.ts parses every row
 * through this before it writes the file, so the CSV cannot drift from the
 * schema. email_status has no "valid" member on purpose: nothing in this
 * pipeline runs an SMTP handshake, so nothing may claim it. */
export const LeadSchema = z
  .object({
    company: z.string().min(1),
    domain: z.string().regex(DOMAIN_RE),
    country: CountrySchema,
    headcount: z.string().min(1),
    company_type: CompanyTypeSchema,
    decision_maker_name: z.string().min(1),
    decision_maker_title: z.string().min(1),
    decision_maker_linkedin: UrlOrEmpty,
    sales_owner_title: z.string().min(1),
    email: z.string().email(),
    email_status: z.enum([
      "mx_ok",
      "mx_ok_role_account",
      "no_mx",
      "invalid_format",
    ]),
    signal_tier: z.enum(["tier_1", "tier_2", "tier_3"]),
    signal_type: z.enum(["hiring", "post", "both", "none"]),
    signal_evidence: z.string(),
    signal_url: UrlOrEmpty,
    source: z.enum(["crunchbase", "clutch"]),
    origin_url: Url,
    captured_at: z.union([z.string().datetime(), z.literal("")]),
  })
  .refine((lead) => lead.signal_tier !== "tier_1" || lead.signal_url !== "", {
    message: "tier_1 requires a signal_url",
    path: ["signal_url"],
  });
export type Lead = z.infer<typeof LeadSchema>;
