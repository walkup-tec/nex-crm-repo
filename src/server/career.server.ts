import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  emptyUpsertCounts,
  normalizeCnpj,
  normalizeCompanyName,
  normalizeContactValue,
  normalizeDomain,
  normalizeJobTitle,
  normalizeJobUrl,
  normalizeLinkedInUrl,
  type CareerUpsertCounts,
} from "@/lib/career-access";
import { assertCareerPanelAccess } from "@/server/career-access.server";

function fail(message: string): never {
  throw new Error(message);
}

function migrationHint(message: string) {
  // Só remapear ausência real de schema/tabela — não mascarar RLS/unique/etc.
  if (/schema cache|PGRST205|relation ["']?career_|could not find the table|does not exist/i.test(message)) {
    return "Aplique a migração 0057_career_intelligence.sql no Supabase.";
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
  verificationStatus?: "confirmed" | "unverified" | "not_found";
  source?: string;
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
    let query = careerFrom("career_companies").select("*").eq("name_normalized", name);
    if (city) query = query.eq("city", city);
    if (state) query = query.eq("state", state);
    const { data } = await query.maybeSingle();
    if (data) return data;
  }
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

  for (const company of input.companies) {
    try {
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

  for (const job of input.jobs) {
    try {
      if (!job.title?.trim()) {
        counts.errors += 1;
        continue;
      }
      const urlNorm = normalizeJobUrl(job.url ?? "");
      const titleNorm = normalizeJobTitle(job.title);
      let existing = null as Record<string, unknown> | null;
      if (urlNorm) {
        const { data } = await careerFrom("career_jobs").select("*").eq("url_normalized", urlNorm).maybeSingle();
        existing = data;
      }
      if (!existing && job.companyId && titleNorm) {
        const { data } = await careerFrom("career_jobs")
          .select("*")
          .eq("company_id", job.companyId)
          .eq("title_normalized", titleNorm)
          .eq("platform", job.platform?.trim() ?? "")
          .maybeSingle();
        existing = data;
      }

      const row = {
        company_id: job.companyId || null,
        company_name: job.companyName?.trim() ?? "",
        title: job.title.trim(),
        title_normalized: titleNorm,
        description: job.description?.trim() ?? "",
        url: job.url?.trim() ?? "",
        url_normalized: urlNorm,
        platform: job.platform?.trim() ?? "",
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
          else counts.errors += 1;
          continue;
        }
        counts.created += 1;
        continue;
      }

      const researchIds = Array.isArray(existing.research_ids) ? [...existing.research_ids] : [];
      if (!researchIds.includes(started.execution.id)) researchIds.push(started.execution.id);
      const { error } = await careerFrom("career_jobs")
        .update({ ...row, research_ids: researchIds })
        .eq("id", existing.id);
      if (error) {
        counts.errors += 1;
        continue;
      }
      counts.updated += 1;
    } catch {
      counts.errors += 1;
    }
  }

  const status = counts.errors && (counts.created || counts.updated) ? "partial" : counts.errors ? "error" : "completed";
  await finishExecution(started.execution.id, counts, status);
  return { executionId: started.execution.id as string, counts, replay: false };
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

  for (const contact of input.contacts) {
    try {
      let companyId = contact.companyId ?? "";
      if (!companyId && contact.companyName) {
        const found = await findCompany({ name: contact.companyName });
        companyId = found?.id ?? "";
      }
      if (!companyId) {
        counts.errors += 1;
        continue;
      }
      const valueNorm = normalizeContactValue(contact.value);
      if (!valueNorm && contact.verificationStatus !== "not_found") {
        counts.errors += 1;
        continue;
      }
      const existing = await careerFrom("career_contacts")
        .select("*")
        .eq("company_id", companyId)
        .eq("kind", contact.kind)
        .eq("value_normalized", valueNorm || `not_found:${contact.kind}`)
        .maybeSingle();

      const row = {
        company_id: companyId,
        kind: contact.kind,
        full_name: contact.fullName?.trim() ?? "",
        title: contact.title?.trim() ?? "",
        value: contact.value?.trim() ?? "",
        value_normalized: valueNorm || `not_found:${contact.kind}`,
        verification_status: contact.verificationStatus ?? "unverified",
        source: contact.source?.trim() ?? "",
        verified_at: contact.verificationStatus === "confirmed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (existing.data) {
        const { error } = await careerFrom("career_contacts").update(row).eq("id", existing.data.id);
        if (error) counts.errors += 1;
        else counts.updated += 1;
      } else {
        const { error } = await careerFrom("career_contacts").insert(row);
        if (error) {
          if (/duplicate|unique/i.test(error.message)) counts.duplicates += 1;
          else counts.errors += 1;
        } else counts.created += 1;
      }

      if (contact.kind === "hr_email" && contact.value) {
        await careerFrom("career_companies")
          .update({ hr_email: contact.value.trim(), last_enriched_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", companyId);
      }
    } catch {
      counts.errors += 1;
    }
  }

  const status = counts.errors && (counts.created || counts.updated) ? "partial" : counts.errors ? "error" : "completed";
  await finishExecution(started.execution.id, counts, status);
  return { executionId: started.execution.id as string, counts, replay: false };
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
  return { items: data ?? [], total: count ?? 0 };
}

export async function listCareerJobs(userId: string, query?: { q?: string; limit?: number; offset?: number }) {
  await assertCareerPanelAccess(userId);
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_jobs").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.q?.trim()) req = req.or(`title.ilike.%${query.q.trim()}%,company_name.ilike.%${query.q.trim()}%`);
  const { data, error, count } = await req;
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [], total: count ?? 0 };
}

export async function listCareerContacts(userId: string, query?: { companyId?: string; limit?: number; offset?: number }) {
  await assertCareerPanelAccess(userId);
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_contacts").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.companyId) req = req.eq("company_id", query.companyId);
  const { data, error, count } = await req;
  if (error) fail(migrationHint(error.message));
  return { items: data ?? [], total: count ?? 0 };
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

  const body = String(app.email_body || app.intro_message || "").trim();
  if (!body) fail("A candidatura não tem texto de e-mail (email_body/intro_message).");

  const jobTitle = String(job?.title || "Vaga");
  const companyName = String(company?.name || "Empresa");
  const subject = `Candidatura — ${jobTitle} — ${companyName}`;

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
    await sendCareerApplicationMail({ to, subject, text: body });
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
  return { items: data ?? [], total: count ?? 0 };
}

export async function pluginGetCompany(id: string) {
  const { data, error } = await careerFrom("career_companies").select("*").eq("id", id).maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Empresa não encontrada.");
  return data;
}

export async function pluginListJobs(query?: { q?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(query?.limit ?? 50, 1), 200);
  const offset = Math.max(query?.offset ?? 0, 0);
  let req = careerFrom("career_jobs").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (query?.q?.trim()) req = req.or(`title.ilike.%${query.q.trim()}%,company_name.ilike.%${query.q.trim()}%`);
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
