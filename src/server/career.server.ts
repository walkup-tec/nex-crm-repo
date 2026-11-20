import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  asCareerRecord,
  deriveEnrichmentStatus,
  emptyUpsertCounts,
  normalizeCareerContactKind,
  normalizeCareerResearchMode,
  normalizeCnpj,
  normalizeCompanyName,
  normalizeContactValue,
  normalizeDomain,
  normalizeJobTitle,
  normalizeJobUrl,
  normalizeLinkedInUrl,
  parsePhoneParts,
  pickCareerField,
  type CareerUpsertCounts,
} from "@/lib/career-access";
import { assertCareerPanelAccess } from "@/server/career-access.server";

function fail(message: string): never {
  throw new Error(message);
}

function migrationHint(message: string) {
  // Só remapear ausência real de schema/tabela — não mascarar RLS/unique/etc.
  if (/schema cache|PGRST205|relation ["']?career_|could not find the table|does not exist/i.test(message)) {
    return "Aplique as migrações Career (0057+) no Supabase, inclusive 0061_career_enrichment_v030.sql se usar enrich v0.3.0.";
  }
  return message;
}

/** Tabelas career ainda fora do Database types gerado — evita from() tipado quebrado. */
function careerFrom(table: string) {
  return (supabaseAdmin as unknown as { from: (name: string) => ReturnType<typeof supabaseAdmin.from> }).from(table);
}

type CompanyInput = {
  name: string;
  cnpj?: string;
  website?: string;
  linkedinUrl?: string;
  segment?: string;
  category?: string;
  city?: string;
  state?: string;
  corporateEmail?: string;
  hrEmail?: string;
  businessWhatsapp?: string;
  recruiterNames?: string;
  source?: string;
  prospectStatus?: string;
};

type ContactInput = {
  companyId?: string;
  companyName?: string;
  kind: string;
  fullName?: string;
  title?: string;
  value: string;
  label?: string;
  sourceUrl?: string;
  suitabilityForApplication?: "suitable" | "unsuitable" | "unknown";
  verificationStatus?: "confirmed" | "unverified" | "not_found";
  source?: string;
  phoneDdi?: string;
  phoneDdd?: string;
  phoneNumber?: string;
};

type JobInput = {
  companyId?: string;
  companyName?: string;
  title: string;
  description?: string;
  url?: string;
  platform?: string;
  location?: string;
  workMode?: string;
  contractType?: string;
  salaryRange?: string;
  requirements?: string;
  publishedAt?: string;
  applicationChannel?: string;
  compatibilityScore?: number;
  compatibilityNotes?: string;
  opportunityStatus?: string;
  source?: string;
  researchMode?: string;
  externalId?: string;
};

type ApplicationPrepareInput = {
  jobId: string;
  compatibilityAnalysis?: string;
  recommendedResume?: string;
  introMessage?: string;
  emailBody?: string;
  linkedinMessage?: string;
  whatsappMessage?: string;
  guidance?: string;
};

async function createExecution(input: {
  kind: string;
  actorSource: "plugin" | "panel";
  actorUserId?: string | null;
  idempotencyKey?: string | null;
  requestJson?: unknown;
}) {
  if (input.idempotencyKey) {
    const existing = await careerFrom("career_executions")
      .select("*")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing.data) {
      return { execution: existing.data, replay: true as const };
    }
  }

  const { data, error } = await careerFrom("career_executions")
    .insert({
      kind: input.kind,
      status: "running",
      actor_source: input.actorSource,
      actor_user_id: input.actorUserId ?? null,
      idempotency_key: input.idempotencyKey || null,
      request_json: input.requestJson ?? {},
    })
    .select("*")
    .single();
  if (error) fail(migrationHint(error.message));
  return { execution: data, replay: false as const };
}

async function finishExecution(
  id: string,
  summary: CareerUpsertCounts & Record<string, unknown>,
  status: "completed" | "partial" | "error" = "completed",
  errorMessage = "",
) {
  const { error } = await careerFrom("career_executions")
    .update({
      status,
      summary_json: summary,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) fail(migrationHint(error.message));
}

async function findCompany(input: CompanyInput) {
  const cnpj = normalizeCnpj(input.cnpj ?? "");
  const domain = normalizeDomain(input.website ?? "");
  const linkedin = normalizeLinkedInUrl(input.linkedinUrl ?? "");
  const name = normalizeCompanyName(input.name);
  const city = (input.city ?? "").trim();
  const state = (input.state ?? "").trim().toUpperCase();

  if (cnpj) {
    const { data } = await careerFrom("career_companies").select("*").eq("cnpj", cnpj).maybeSingle();
    if (data) return data;
  }
  if (domain) {
    const { data } = await careerFrom("career_companies").select("*").eq("domain_normalized", domain).maybeSingle();
    if (data) return data;
  }
  if (linkedin) {
    const { data } = await careerFrom("career_companies").select("*").eq("linkedin_normalized", linkedin).maybeSingle();
    if (data) return data;
  }
  if (name) {
    if (city || state) {
      let query = careerFrom("career_companies").select("*").eq("name_normalized", name);
      if (city) query = query.eq("city", city);
      if (state) query = query.eq("state", state);
      const { data, error } = await query.maybeSingle();
      if (!error && data) return data;
    }
    // Só aceita correspondência inequívoca por nome (evita maybeSingle em nomes ambíguos).
    const { data } = await careerFrom("career_companies").select("*").eq("name_normalized", name).limit(2);
    if (Array.isArray(data) && data.length === 1) return data[0];
  }
  return null;
}

function numField(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

/** Normaliza payload GPT/MCP (camelCase ou snake_case) para CompanyInput. */
export function normalizeCompanyInput(raw: unknown): CompanyInput {
  const row = asCareerRecord(raw);
  return {
    name: pickCareerField(row, "name"),
    cnpj: pickCareerField(row, "cnpj") || undefined,
    website: pickCareerField(row, "website") || undefined,
    linkedinUrl: pickCareerField(row, "linkedinUrl", "linkedin_url") || undefined,
    segment: pickCareerField(row, "segment") || undefined,
    category: pickCareerField(row, "category") || undefined,
    city: pickCareerField(row, "city") || undefined,
    state: pickCareerField(row, "state") || undefined,
    corporateEmail: pickCareerField(row, "corporateEmail", "corporate_email") || undefined,
    hrEmail: pickCareerField(row, "hrEmail", "hr_email") || undefined,
    businessWhatsapp: pickCareerField(row, "businessWhatsapp", "business_whatsapp") || undefined,
    recruiterNames: pickCareerField(row, "recruiterNames", "recruiter_names") || undefined,
    source: pickCareerField(row, "source") || undefined,
    prospectStatus: pickCareerField(row, "prospectStatus", "prospect_status") || undefined,
  };
}

/** Normaliza payload GPT/MCP para JobInput. */
export function normalizeJobInput(raw: unknown): JobInput {
  const row = asCareerRecord(raw);
  return {
    companyId: pickCareerField(row, "companyId", "company_id") || undefined,
    companyName: pickCareerField(row, "companyName", "company_name") || undefined,
    title: pickCareerField(row, "title"),
    description: pickCareerField(row, "description") || undefined,
    url: pickCareerField(row, "url") || undefined,
    platform: pickCareerField(row, "platform") || undefined,
    location: pickCareerField(row, "location") || undefined,
    workMode: pickCareerField(row, "workMode", "work_mode") || undefined,
    contractType: pickCareerField(row, "contractType", "contract_type") || undefined,
    salaryRange: pickCareerField(row, "salaryRange", "salary_range") || undefined,
    requirements: pickCareerField(row, "requirements") || undefined,
    publishedAt: pickCareerField(row, "publishedAt", "published_at") || undefined,
    applicationChannel: pickCareerField(row, "applicationChannel", "application_channel") || undefined,
    compatibilityScore: numField(row, "compatibilityScore", "compatibility_score"),
    compatibilityNotes: pickCareerField(row, "compatibilityNotes", "compatibility_notes") || undefined,
    opportunityStatus: pickCareerField(row, "opportunityStatus", "opportunity_status") || undefined,
    source: pickCareerField(row, "source") || undefined,
    researchMode: pickCareerField(row, "researchMode", "research_mode") || undefined,
    externalId: pickCareerField(row, "externalId", "external_id") || undefined,
  };
}

/** Normaliza payload GPT/MCP para ContactInput. */
export function normalizeContactInput(raw: unknown): ContactInput {
  const row = asCareerRecord(raw);
  const verification = pickCareerField(row, "verificationStatus", "verification_status");
  const suitability = pickCareerField(row, "suitabilityForApplication", "suitability_for_application");
  return {
    companyId: pickCareerField(row, "companyId", "company_id") || undefined,
    companyName: pickCareerField(row, "companyName", "company_name") || undefined,
    kind: pickCareerField(row, "kind"),
    fullName: pickCareerField(row, "fullName", "full_name") || undefined,
    title: pickCareerField(row, "title", "job_title", "jobTitle") || undefined,
    value: pickCareerField(row, "value"),
    label: pickCareerField(row, "label") || undefined,
    sourceUrl: pickCareerField(row, "sourceUrl", "source_url") || undefined,
    suitabilityForApplication:
      suitability === "suitable" || suitability === "unsuitable" || suitability === "unknown"
        ? suitability
        : undefined,
    verificationStatus:
      verification === "confirmed" || verification === "unverified" || verification === "not_found"
        ? verification
        : undefined,
    source: pickCareerField(row, "source") || undefined,
    phoneDdi: pickCareerField(row, "phoneDdi", "phone_ddi", "ddi") || undefined,
    phoneDdd: pickCareerField(row, "phoneDdd", "phone_ddd", "ddd") || undefined,
    phoneNumber: pickCareerField(row, "phoneNumber", "phone_number") || undefined,
  };
}

/**
 * Resolve company_id: usa UUID informado se existir; senão nome com correspondência inequívoca.
 */
async function resolveCompanyId(companyId?: string, companyName?: string): Promise<string | null> {
  const id = companyId?.trim() ?? "";
  if (id) {
    const { data } = await careerFrom("career_companies").select("id").eq("id", id).maybeSingle();
    if (data?.id) return String(data.id);
  }
  const name = normalizeCompanyName(companyName ?? "");
  if (!name) return null;
  const { data } = await careerFrom("career_companies").select("id").eq("name_normalized", name).limit(2);
  if (Array.isArray(data) && data.length === 1) return String(data[0]!.id);
  return null;
}

function companyPatch(existing: Record<string, unknown>, input: CompanyInput) {
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const assign = (column: string, value: string | undefined) => {
    if (!value?.trim()) return;
    if (!existing[column] || existing[column] === "") patch[column] = value.trim();
    else if (existing[column] !== value.trim()) patch[column] = value.trim();
  };
  assign("website", input.website);
  assign("linkedin_url", input.linkedinUrl);
  assign("segment", input.segment);
  assign("category", input.category);
  assign("city", input.city);
  assign("state", input.state?.toUpperCase());
  assign("corporate_email", input.corporateEmail);
  assign("hr_email", input.hrEmail);
  assign("business_whatsapp", input.businessWhatsapp);
  assign("recruiter_names", input.recruiterNames);
  assign("source", input.source);
  if (input.prospectStatus) patch["prospect_status"] = input.prospectStatus;
  if (input.cnpj && normalizeCnpj(input.cnpj)) {
    patch["cnpj"] = normalizeCnpj(input.cnpj);
  }
  patch["domain_normalized"] = normalizeDomain(String(patch["website"] ?? existing["website"] ?? input.website ?? ""));
  patch["linkedin_normalized"] = normalizeLinkedInUrl(
    String(patch["linkedin_url"] ?? existing["linkedin_url"] ?? input.linkedinUrl ?? ""),
  );
  patch["name_normalized"] = normalizeCompanyName(String(existing["name"] ?? input.name));
  return patch;
}

export async function upsertCareerCompanies(input: {
  companies: CompanyInput[];
  actorSource: "plugin" | "panel";
  actorUserId?: string | null;
  idempotencyKey?: string | null;
  kind?: string;
}) {
  const started = await createExecution({
    kind: input.kind ?? "companies_discover",
    actorSource: input.actorSource,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
    requestJson: { count: input.companies.length },
  });
  if (started.replay) {
    return {
      executionId: started.execution.id as string,
      counts: (started.execution.summary_json ?? emptyUpsertCounts()) as CareerUpsertCounts,
      replay: true,
    };
  }

  const counts = emptyUpsertCounts();
  counts.received = input.companies.length;
  const errorMessages: string[] = [];

  for (const raw of input.companies) {
    try {
      const company = normalizeCompanyInput(raw);
      if (!company.name?.trim()) {
        counts.errors += 1;
        errorMessages.push("Empresa sem nome.");
        continue;
      }
      const existing = await findCompany(company);
      if (!existing) {
        const row = {
          name: company.name.trim(),
          name_normalized: normalizeCompanyName(company.name),
          cnpj: normalizeCnpj(company.cnpj ?? "") || null,
          website: company.website?.trim() ?? "",
          domain_normalized: normalizeDomain(company.website ?? ""),
          linkedin_url: company.linkedinUrl?.trim() ?? "",
          linkedin_normalized: normalizeLinkedInUrl(company.linkedinUrl ?? ""),
          segment: company.segment?.trim() ?? "",
          category: company.category?.trim() ?? "",
          city: company.city?.trim() ?? "",
          state: company.state?.trim().toUpperCase() ?? "",
          corporate_email: company.corporateEmail?.trim() ?? "",
          hr_email: company.hrEmail?.trim() ?? "",
          business_whatsapp: company.businessWhatsapp?.trim() ?? "",
          recruiter_names: company.recruiterNames?.trim() ?? "",
          source: company.source?.trim() ?? "",
          prospect_status: company.prospectStatus?.trim() || "new",
          research_ids: [started.execution.id],
        };
        const { error } = await careerFrom("career_companies").insert(row);
        if (error) {
          if (/duplicate|unique/i.test(error.message)) {
            counts.duplicates += 1;
          } else {
            counts.errors += 1;
            errorMessages.push(error.message);
          }
          continue;
        }
        counts.created += 1;
        continue;
      }

      const patch = companyPatch(existing, company);
      const researchIds = Array.isArray(existing.research_ids) ? [...existing.research_ids] : [];
      if (!researchIds.includes(started.execution.id)) researchIds.push(started.execution.id);
      patch["research_ids"] = researchIds;
      const meaningful = Object.keys(patch).some(
        (key) => !["last_seen_at", "updated_at", "research_ids", "name_normalized", "domain_normalized", "linkedin_normalized"].includes(key),
      );
      const { error } = await careerFrom("career_companies").update(patch).eq("id", existing.id);
      if (error) {
        counts.errors += 1;
        errorMessages.push(error.message);
        continue;
      }
      if (meaningful) counts.updated += 1;
      else counts.duplicates += 1;
    } catch (error) {
      counts.errors += 1;
      errorMessages.push(error instanceof Error ? error.message : "erro");
    }
  }

  const status = counts.errors && (counts.created || counts.updated) ? "partial" : counts.errors ? "error" : "completed";
  await finishExecution(started.execution.id, { ...counts, error_samples: errorMessages.slice(0, 5) }, status, errorMessages[0] ?? "");
  return { executionId: started.execution.id as string, counts, replay: false };
}

export async function upsertCareerJobs(input: {
  jobs: JobInput[];
  actorSource: "plugin" | "panel";
  actorUserId?: string | null;
  idempotencyKey?: string | null;
}) {
  const started = await createExecution({
    kind: "jobs_search",
    actorSource: input.actorSource,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
    requestJson: { count: input.jobs.length },
  });
  if (started.replay) {
    return {
      executionId: started.execution.id as string,
      counts: (started.execution.summary_json ?? emptyUpsertCounts()) as CareerUpsertCounts,
      replay: true,
    };
  }

  const counts = emptyUpsertCounts();
  counts.received = input.jobs.length;
  const errorMessages: string[] = [];

  for (const raw of input.jobs) {
    try {
      const job = normalizeJobInput(raw);
      if (!job.title?.trim()) {
        counts.errors += 1;
        errorMessages.push("Vaga sem título.");
        continue;
      }
      const resolvedCompanyId = await resolveCompanyId(job.companyId, job.companyName);
      const urlNorm = normalizeJobUrl(job.url ?? "");
      const titleNorm = normalizeJobTitle(job.title);
      const platform = job.platform?.trim() ?? "";
      const externalId = job.externalId?.trim() ?? "";
      const researchMode = normalizeCareerResearchMode(
        job.researchMode || (platform.toLowerCase().includes("linkedin") ? "linkedin_monitor" : "company_prospect"),
      );
      let existing = null as Record<string, unknown> | null;
      if (urlNorm) {
        const { data } = await careerFrom("career_jobs").select("*").eq("url_normalized", urlNorm).maybeSingle();
        existing = data;
      }
      if (!existing && externalId && platform) {
        const { data } = await careerFrom("career_jobs")
          .select("*")
          .eq("external_id", externalId)
          .eq("platform", platform)
          .maybeSingle();
        existing = data;
      }
      if (!existing && resolvedCompanyId && titleNorm) {
        const { data } = await careerFrom("career_jobs")
          .select("*")
          .eq("company_id", resolvedCompanyId)
          .eq("title_normalized", titleNorm)
          .eq("platform", platform)
          .maybeSingle();
        existing = data;
      }

      const companyName =
        job.companyName?.trim() ||
        (resolvedCompanyId
          ? String(
              (
                await careerFrom("career_companies").select("name").eq("id", resolvedCompanyId).maybeSingle()
              ).data?.name ?? "",
            )
          : "");

      const row = {
        company_id: resolvedCompanyId,
        company_name: companyName,
        title: job.title.trim(),
        title_normalized: titleNorm,
        description: job.description?.trim() ?? "",
        url: job.url?.trim() ?? "",
        url_normalized: urlNorm,
        platform,
        location: job.location?.trim() ?? "",
        work_mode: job.workMode?.trim() || "unknown",
        contract_type: job.contractType?.trim() || "unknown",
        salary_range: job.salaryRange?.trim() ?? "",
        requirements: job.requirements?.trim() ?? "",
        published_at: job.publishedAt || null,
        application_channel: job.applicationChannel?.trim() || "unknown",
        compatibility_score: job.compatibilityScore ?? null,
        compatibility_notes: job.compatibilityNotes?.trim() ?? "",
        opportunity_status: job.opportunityStatus?.trim() || "new",
        source: job.source?.trim() ?? "",
        research_mode: researchMode,
        external_id: externalId,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!existing) {
        const { error } = await careerFrom("career_jobs").insert({
          ...row,
          research_ids: [started.execution.id],
        });
        if (error) {
          if (/duplicate|unique/i.test(error.message)) counts.duplicates += 1;
          else {
            counts.errors += 1;
            errorMessages.push(error.message);
          }
          continue;
        }
        counts.created += 1;
        continue;
      }

      const researchIds = Array.isArray(existing.research_ids) ? [...existing.research_ids] : [];
      if (!researchIds.includes(started.execution.id)) researchIds.push(started.execution.id);
      // Preserva company_id já vinculado se a resolução atual falhar.
      if (!row.company_id && existing.company_id) {
        row.company_id = existing.company_id as string;
      }
      if (!row.company_name && existing.company_name) {
        row.company_name = String(existing.company_name);
      }
      const { error } = await careerFrom("career_jobs")
        .update({ ...row, research_ids: researchIds })
        .eq("id", existing.id);
      if (error) {
        counts.errors += 1;
        errorMessages.push(error.message);
        continue;
      }
      counts.updated += 1;
    } catch (error) {
      counts.errors += 1;
      errorMessages.push(error instanceof Error ? error.message : "erro");
    }
  }

  const status = counts.errors && (counts.created || counts.updated) ? "partial" : counts.errors ? "error" : "completed";
  await finishExecution(started.execution.id, { ...counts, error_samples: errorMessages.slice(0, 5) }, status, errorMessages[0] ?? "");
  return {
    executionId: started.execution.id as string,
    counts,
    errorSamples: errorMessages.slice(0, 8),
    replay: false,
  };
}

async function syncCompanyChannelFromContact(companyId: string, kind: string, value: string) {
  if (!value?.trim()) return;
  const patch: Record<string, unknown> = {
    last_enriched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (kind === "hr_email" || kind === "recruiting_email") patch["hr_email"] = value.trim();
  if (kind === "corporate_email") patch["corporate_email"] = value.trim();
  if (kind === "whatsapp" || kind === "business_whatsapp") patch["business_whatsapp"] = value.trim();
  if (kind === "website") {
    patch["website"] = value.trim();
    patch["domain_normalized"] = normalizeDomain(value.trim());
  }
  await careerFrom("career_companies").update(patch).eq("id", companyId);
}

async function refreshCompanyEnrichmentStatus(companyId: string) {
  const { data } = await careerFrom("career_contacts")
    .select("kind")
    .eq("company_id", companyId)
    .neq("verification_status", "not_found");
  const kinds = (data ?? []).map((row) => String(row.kind ?? ""));
  const enrichmentStatus = deriveEnrichmentStatus(kinds);
  await careerFrom("career_companies")
    .update({
      enrichment_status: enrichmentStatus,
      last_enriched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);
}

async function attachCompanyCounts(companies: Record<string, unknown>[]) {
  if (!companies.length) return companies;
  const ids = companies.map((row) => String(row.id));
  const [contactsRes, jobsRes] = await Promise.all([
    careerFrom("career_contacts").select("company_id, kind, verification_status").in("company_id", ids),
    careerFrom("career_jobs").select("company_id").in("company_id", ids),
  ]);
  const contactCount = new Map<string, number>();
  const kindByCompany = new Map<string, string[]>();
  for (const row of contactsRes.data ?? []) {
    const companyId = String(row.company_id);
    if (row.verification_status === "not_found") continue;
    contactCount.set(companyId, (contactCount.get(companyId) ?? 0) + 1);
    const list = kindByCompany.get(companyId) ?? [];
    list.push(String(row.kind ?? ""));
    kindByCompany.set(companyId, list);
  }
  const jobCount = new Map<string, number>();
  for (const row of jobsRes.data ?? []) {
    const companyId = String(row.company_id ?? "");
    if (!companyId) continue;
    jobCount.set(companyId, (jobCount.get(companyId) ?? 0) + 1);
  }
  return companies.map((row) => {
    const id = String(row.id);
    const enrichment =
      row.enrichment_status && row.enrichment_status !== "none"
        ? String(row.enrichment_status)
        : deriveEnrichmentStatus(kindByCompany.get(id) ?? []);
    return {
      ...row,
      contact_count: contactCount.get(id) ?? 0,
      job_count: jobCount.get(id) ?? 0,
      enrichment_status: enrichment,
    };
  });
}

export async function enrichCareerContacts(input: {
  contacts: ContactInput[];
  actorSource: "plugin" | "panel";
  actorUserId?: string | null;
  idempotencyKey?: string | null;
}) {
  const started = await createExecution({
    kind: "companies_enrich",
    actorSource: input.actorSource,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
    requestJson: { count: input.contacts.length },
  });
  if (started.replay) {
    return {
      executionId: started.execution.id as string,
      counts: (started.execution.summary_json ?? emptyUpsertCounts()) as CareerUpsertCounts,
      replay: true,
    };
  }

  const counts = emptyUpsertCounts();
  counts.received = input.contacts.length;
  const errorMessages: string[] = [];

  const touchedCompanies = new Set<string>();

  for (const raw of input.contacts) {
    try {
      const contact = normalizeContactInput(raw);
      const kind = normalizeCareerContactKind(contact.kind);
      if (!kind) {
        counts.errors += 1;
        errorMessages.push(`kind inválido: ${contact.kind || "(vazio)"}`);
        continue;
      }
      const companyId = (await resolveCompanyId(contact.companyId, contact.companyName)) ?? "";
      if (!companyId) {
        counts.errors += 1;
        errorMessages.push(
          `empresa não resolvida (companyId=${contact.companyId || "—"}, companyName=${contact.companyName || "—"})`,
        );
        continue;
      }
      touchedCompanies.add(companyId);

      const isPhoneLike = kind === "whatsapp" || kind === "phone" || kind === "business_whatsapp";
      const phoneParts = isPhoneLike ? parsePhoneParts(contact.value || contact.phoneNumber || "") : null;
      const valueRaw = contact.value?.trim() || (phoneParts?.digits ? `+${phoneParts.digits}` : "");
      const valueNorm = isPhoneLike
        ? phoneParts?.digits || normalizeContactValue(valueRaw)
        : kind === "website" || kind === "instagram" || kind === "facebook" || kind === "recruiter_linkedin"
          ? normalizeJobUrl(valueRaw) || normalizeContactValue(valueRaw)
          : normalizeContactValue(valueRaw);

      if (!valueNorm && contact.verificationStatus !== "not_found") {
        counts.errors += 1;
        errorMessages.push(`contato sem value (kind=${kind}, companyId=${companyId})`);
        continue;
      }
      const existing = await careerFrom("career_contacts")
        .select("*")
        .eq("company_id", companyId)
        .eq("kind", kind)
        .eq("value_normalized", valueNorm || `not_found:${kind}`)
        .maybeSingle();

      const row = {
        company_id: companyId,
        kind,
        full_name: contact.fullName?.trim() ?? "",
        title: contact.title?.trim() ?? "",
        value: valueRaw,
        value_normalized: valueNorm || `not_found:${kind}`,
        label: contact.label?.trim() ?? "",
        source_url: contact.sourceUrl?.trim() ?? "",
        suitability_for_application: contact.suitabilityForApplication ?? "unknown",
        verification_status: contact.verificationStatus ?? "unverified",
        source: contact.source?.trim() ?? "",
        phone_ddi: contact.phoneDdi?.trim() || phoneParts?.ddi || "",
        phone_ddd: contact.phoneDdd?.trim() || phoneParts?.ddd || "",
        phone_number: contact.phoneNumber?.trim() || phoneParts?.number || "",
        verified_at: contact.verificationStatus === "confirmed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (existing.data) {
        const { error } = await careerFrom("career_contacts").update(row).eq("id", existing.data.id);
        if (error) {
          counts.errors += 1;
          errorMessages.push(error.message);
        } else counts.updated += 1;
      } else {
        const { error } = await careerFrom("career_contacts").insert(row);
        if (error) {
          if (/duplicate|unique/i.test(error.message)) counts.duplicates += 1;
          else {
            counts.errors += 1;
            errorMessages.push(error.message);
          }
        } else counts.created += 1;
      }

      await syncCompanyChannelFromContact(companyId, kind, valueRaw);
    } catch (error) {
      counts.errors += 1;
      errorMessages.push(error instanceof Error ? error.message : "erro");
    }
  }

  for (const companyId of touchedCompanies) {
    await refreshCompanyEnrichmentStatus(companyId);
  }

  const status = counts.errors && (counts.created || counts.updated) ? "partial" : counts.errors ? "error" : "completed";
  await finishExecution(
    started.execution.id,
    { ...counts, error_samples: errorMessages.slice(0, 5) },
    status,
    errorMessages[0] ?? "",
  );
  return {
    executionId: started.execution.id as string,
    counts,
    errorSamples: errorMessages.slice(0, 8),
    replay: false,
  };
}

/** Atualização idempotente de vínculos job→company (não recria registros). */
export async function linkCareerJobsToCompanies(
  links: Array<{ jobId: string; companyId: string }>,
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const link of links) {
    const jobId = link.jobId?.trim();
    const companyId = link.companyId?.trim();
    if (!jobId || !companyId) {
      skipped += 1;
      continue;
    }
    const company = await careerFrom("career_companies").select("id, name").eq("id", companyId).maybeSingle();
    if (!company.data) {
      errors.push(`empresa inexistente: ${companyId}`);
      continue;
    }
    const job = await careerFrom("career_jobs").select("id, company_id").eq("id", jobId).maybeSingle();
    if (!job.data) {
      errors.push(`vaga inexistente: ${jobId}`);
      continue;
    }
    if (String(job.data.company_id ?? "") === companyId) {
      skipped += 1;
      continue;
    }
    const { error } = await careerFrom("career_jobs")
      .update({
        company_id: companyId,
        company_name: String(company.data.name ?? ""),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (error) errors.push(error.message);
    else updated += 1;
  }
  return { updated, skipped, errors };
}

export async function prepareCareerApplication(input: ApplicationPrepareInput & {
  actorSource: "plugin" | "panel";
  actorUserId?: string | null;
  idempotencyKey?: string | null;
}) {
  const started = await createExecution({
    kind: "application_prepare",
    actorSource: input.actorSource,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
    requestJson: { jobId: input.jobId },
  });
  if (started.replay) {
    return {
      executionId: started.execution.id as string,
      applicationId: (started.execution.summary_json as { applicationId?: string } | null)?.applicationId ?? null,
      counts: (started.execution.summary_json ?? emptyUpsertCounts()) as CareerUpsertCounts,
      replay: true,
    };
  }

  const { data: job, error: jobError } = await careerFrom("career_jobs").select("*").eq("id", input.jobId).maybeSingle();
  if (jobError) fail(migrationHint(jobError.message));
  if (!job) fail("Vaga não encontrada.");

  const { data, error } = await careerFrom("career_applications")
    .insert({
      job_id: job.id,
      company_id: job.company_id,
      status: "ready",
      compatibility_analysis: input.compatibilityAnalysis?.trim() ?? "",
      recommended_resume: input.recommendedResume?.trim() ?? "",
      intro_message: input.introMessage?.trim() ?? "",
      email_body: input.emailBody?.trim() ?? "",
      linkedin_message: input.linkedinMessage?.trim() ?? "",
      whatsapp_message: input.whatsappMessage?.trim() ?? "",
      guidance: input.guidance?.trim() ?? "",
    })
    .select("id")
    .single();
  if (error) fail(migrationHint(error.message));

  await careerFrom("career_jobs")
    .update({ opportunity_status: "prepared", updated_at: new Date().toISOString() })
    .eq("id", job.id);

  const counts = { ...emptyUpsertCounts(), received: 1, created: 1 };
  await finishExecution(started.execution.id, { ...counts, applicationId: data.id });
  return { executionId: started.execution.id as string, applicationId: data.id as string, counts, replay: false };
}

export async function listCareerCompanies(userId: string, query?: { q?: string; limit?: number; offset?: number }) {
  await assertCareerPanelAccess(userId);
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_companies").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.q?.trim()) req = req.ilike("name", `%${query.q.trim()}%`);
  const { data, error, count } = await req;
  if (error) fail(migrationHint(error.message));
  const items = await attachCompanyCounts((data ?? []) as Record<string, unknown>[]);
  return { items, total: count ?? 0 };
}

export async function getCareerCompanyDetail(userId: string, id: string) {
  await assertCareerPanelAccess(userId);
  return pluginGetCompany(id);
}

export async function listCareerJobs(
  userId: string,
  query?: { q?: string; platform?: string; researchMode?: string; limit?: number; offset?: number },
) {
  await assertCareerPanelAccess(userId);
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_jobs").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.q?.trim()) req = req.or(`title.ilike.%${query.q.trim()}%,company_name.ilike.%${query.q.trim()}%`);
  if (query?.platform?.trim()) req = req.ilike("platform", `%${query.platform.trim()}%`);
  if (query?.researchMode?.trim()) req = req.eq("research_mode", normalizeCareerResearchMode(query.researchMode));
  const { data, error, count } = await req;
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [], total: count ?? 0 };
}

export async function listCareerContacts(
  userId: string,
  query?: { companyId?: string; kind?: string; verificationStatus?: string; limit?: number; offset?: number },
) {
  await assertCareerPanelAccess(userId);
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_contacts").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.companyId) req = req.eq("company_id", query.companyId);
  if (query?.kind?.trim()) {
    const kind = normalizeCareerContactKind(query.kind) || query.kind.trim();
    req = req.eq("kind", kind);
  }
  if (query?.verificationStatus?.trim()) req = req.eq("verification_status", query.verificationStatus.trim());
  const { data, error, count } = await req;
  if (error) fail(migrationHint(error.message));
  const companyIds = [...new Set((data ?? []).map((row) => String(row.company_id)).filter(Boolean))];
  const companies =
    companyIds.length > 0
      ? await careerFrom("career_companies").select("id, name").in("id", companyIds)
      : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((companies.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const items = (data ?? []).map((row) => ({
    ...row,
    company_name: nameById.get(String(row.company_id)) ?? "",
  }));
  return { items, total: count ?? 0 };
}

export async function listCareerApplications(userId: string) {
  await assertCareerPanelAccess(userId);
  const { data, error } = await careerFrom("career_applications").select("*").order("updated_at", { ascending: false }).limit(100);
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [] };
}

export async function listCareerHistory(userId: string) {
  await assertCareerPanelAccess(userId);
  const { data, error } = await careerFrom("career_executions").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [] };
}

export async function getCareerExecution(userId: string, executionId: string) {
  await assertCareerPanelAccess(userId);
  const { data, error } = await careerFrom("career_executions").select("*").eq("id", executionId).maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Execução não encontrada.");
  return data;
}

export async function patchCareerCompany(userId: string, id: string, patch: Partial<CompanyInput> & { prospectStatus?: string }) {
  await assertCareerPanelAccess(userId);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name) {
    updates["name"] = patch.name.trim();
    updates["name_normalized"] = normalizeCompanyName(patch.name);
  }
  if (patch.prospectStatus) updates["prospect_status"] = patch.prospectStatus;
  if (patch.website !== undefined) {
    updates["website"] = patch.website;
    updates["domain_normalized"] = normalizeDomain(patch.website);
  }
  if (patch.hrEmail !== undefined) updates["hr_email"] = patch.hrEmail;
  if (patch.corporateEmail !== undefined) updates["corporate_email"] = patch.corporateEmail;
  if (patch.businessWhatsapp !== undefined) updates["business_whatsapp"] = patch.businessWhatsapp;
  const { data, error } = await careerFrom("career_companies").update(updates).eq("id", id).select("*").maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Empresa não encontrada.");
  return data;
}

export async function patchCareerJob(userId: string, id: string, patch: { opportunityStatus?: string; compatibilityNotes?: string }) {
  await assertCareerPanelAccess(userId);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.opportunityStatus) updates["opportunity_status"] = patch.opportunityStatus;
  if (patch.compatibilityNotes !== undefined) updates["compatibility_notes"] = patch.compatibilityNotes;
  const { data, error } = await careerFrom("career_jobs").update(updates).eq("id", id).select("*").maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Vaga não encontrada.");
  return data;
}

export async function patchCareerApplication(
  userId: string,
  id: string,
  patch: { status?: string },
) {
  await assertCareerPanelAccess(userId);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    updates["status"] = patch.status;
    if (patch.status === "approved") {
      updates["approved_at"] = new Date().toISOString();
      updates["approved_by"] = userId;
    }
  }
  const { data, error } = await careerFrom("career_applications").update(updates).eq("id", id).select("*").maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Candidatura não encontrada.");
  return data;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Envia candidatura aprovada por e-mail (remetente CAREER_SMTP_* / mozart.linkedin). */
export async function sendCareerApplicationEmail(
  userId: string,
  applicationId: string,
  toEmail?: string | null,
) {
  await assertCareerPanelAccess(userId);

  const { data: app, error: appError } = await careerFrom("career_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (appError) fail(migrationHint(appError.message));
  if (!app) fail("Candidatura não encontrada.");
  if (app.status !== "approved" && app.status !== "ready") {
    fail("Só é possível enviar candidaturas prontas ou aprovadas.");
  }

  const [{ data: job }, { data: company }] = await Promise.all([
    careerFrom("career_jobs").select("id, title, company_id").eq("id", app.job_id).maybeSingle(),
    app.company_id
      ? careerFrom("career_companies").select("id, name, hr_email, corporate_email").eq("id", app.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const testTo = process.env["CAREER_APPLICATION_TEST_TO"]?.trim() ?? "";
  const explicit = (toEmail ?? "").trim();
  const companyTo = String(company?.hr_email || company?.corporate_email || "").trim();
  const to = explicit || testTo || companyTo;
  if (!isValidEmail(to)) {
    fail("Informe um e-mail de destino válido (ou configure CAREER_APPLICATION_TEST_TO).");
  }

  const jobTitle = String(job?.title || "Vaga");
  const companyName = String(company?.name || "Empresa");
  const subject = `Candidatura — ${jobTitle} — ${companyName}`;

  const { CAREER_APPLICATION_EMAIL_TEXT, careerApplicationEmailHtml } = await import(
    "@/lib/career-application-email"
  );
  const body = CAREER_APPLICATION_EMAIL_TEXT;
  const html = careerApplicationEmailHtml();

  let executionId: string | null = null;
  try {
    const started = await createExecution({
      kind: "application_send",
      actorSource: "panel",
      actorUserId: userId,
      requestJson: { applicationId, to },
    });
    executionId = String(started.execution.id);
  } catch (error) {
    // Sem migração 0058 o CHECK de kind bloqueia o log — o envio segue.
    console.error("career_application_send_log", error instanceof Error ? error.message : "error");
  }

  try {
    const { sendCareerApplicationMail } = await import("@/server/mail.server");
    await sendCareerApplicationMail({ to, subject, text: body, html });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar e-mail.";
    if (executionId) {
      await finishExecution(executionId, { applicationId, to, error: message }, "error", message);
    }
    fail(message);
  }

  const stamp = new Date().toISOString();
  const guidanceNote = `Enviado por e-mail para ${to} em ${stamp}.`;
  const previousGuidance = String(app.guidance || "").trim();
  const { data: updated, error: updateError } = await careerFrom("career_applications")
    .update({
      status: "sent",
      guidance: previousGuidance ? `${previousGuidance}\n${guidanceNote}` : guidanceNote,
      updated_at: stamp,
    })
    .eq("id", applicationId)
    .select("*")
    .maybeSingle();
  if (updateError) fail(migrationHint(updateError.message));

  if (executionId) {
    await finishExecution(executionId, { applicationId, to, subject }, "completed");
  }
  return { application: updated, to, subject };
}

export async function careerOverview(userId: string) {
  await assertCareerPanelAccess(userId);
  const [companies, jobs, contacts, applications, executions] = await Promise.all([
    careerFrom("career_companies").select("id", { count: "exact", head: true }),
    careerFrom("career_jobs").select("id, opportunity_status, compatibility_score", { count: "exact" }),
    careerFrom("career_contacts").select("id", { count: "exact", head: true }),
    careerFrom("career_applications").select("id, status", { count: "exact" }),
    careerFrom("career_executions").select("id", { count: "exact", head: true }),
  ]);
  if (companies.error) fail(migrationHint(companies.error.message));
  if (jobs.error) fail(migrationHint(jobs.error.message));
  if (contacts.error) fail(migrationHint(contacts.error.message));
  if (applications.error) fail(migrationHint(applications.error.message));
  if (executions.error) fail(migrationHint(executions.error.message));

  const jobRows = jobs.data ?? [];
  const appRows = applications.data ?? [];
  return {
    companies: companies.count ?? 0,
    jobs: jobs.count ?? 0,
    compatibleJobs: jobRows.filter((row) => Number(row.compatibility_score ?? 0) >= 70).length,
    contacts: contacts.count ?? 0,
    applicationsPrepared: appRows.filter((row) => row.status === "ready" || row.status === "approved" || row.status === "sent").length,
    applicationsApproved: appRows.filter((row) => row.status === "approved" || row.status === "sent").length,
    executions: executions.count ?? 0,
  };
}

/** Leituras para o plugin (já autenticado pelo Bearer da integração). */
export async function pluginListCompanies(query?: { q?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_companies").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.q?.trim()) req = req.ilike("name", `%${query.q.trim()}%`);
  const { data, error, count } = await req;
  if (error) fail(migrationHint(error.message));
  const items = await attachCompanyCounts((data ?? []) as Record<string, unknown>[]);
  return { items, total: count ?? 0 };
}

export async function pluginGetCompany(id: string) {
  const { data, error } = await careerFrom("career_companies").select("*").eq("id", id).maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Empresa não encontrada.");
  const [contacts, jobs] = await Promise.all([
    careerFrom("career_contacts").select("*").eq("company_id", id).order("updated_at", { ascending: false }).limit(200),
    careerFrom("career_jobs").select("*").eq("company_id", id).order("updated_at", { ascending: false }).limit(100),
  ]);
  if (contacts.error) fail(migrationHint(contacts.error.message));
  if (jobs.error) fail(migrationHint(jobs.error.message));
  const contactItems = contacts.data ?? [];
  const jobItems = jobs.data ?? [];
  const enrichment =
    data.enrichment_status && data.enrichment_status !== "none"
      ? String(data.enrichment_status)
      : deriveEnrichmentStatus(contactItems.map((row) => String(row.kind ?? "")));
  return {
    ...data,
    enrichment_status: enrichment,
    contact_count: contactItems.filter((row) => row.verification_status !== "not_found").length,
    job_count: jobItems.length,
    contacts: contactItems,
    jobs: jobItems,
  };
}

export async function pluginListJobs(query?: { q?: string; platform?: string; researchMode?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_jobs").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.q?.trim()) req = req.or(`title.ilike.%${query.q.trim()}%,company_name.ilike.%${query.q.trim()}%`);
  if (query?.platform?.trim()) req = req.ilike("platform", `%${query.platform.trim()}%`);
  if (query?.researchMode?.trim()) req = req.eq("research_mode", normalizeCareerResearchMode(query.researchMode));
  const { data, error, count } = await req;
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [], total: count ?? 0 };
}

export async function pluginGetJob(id: string) {
  const { data, error } = await careerFrom("career_jobs").select("*").eq("id", id).maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Vaga não encontrada.");
  return data;
}

export async function pluginListApplications() {
  const { data, error } = await careerFrom("career_applications").select("*").order("updated_at", { ascending: false }).limit(100);
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [] };
}

export async function pluginListHistory() {
  const { data, error } = await careerFrom("career_executions").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [] };
}

export async function pluginGetExecution(id: string) {
  const { data, error } = await careerFrom("career_executions").select("*").eq("id", id).maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Execução não encontrada.");
  return data;
}
