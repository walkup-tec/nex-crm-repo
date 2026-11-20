import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Result<T> = { ok: true; data: T } | { ok: false; message: string; status?: number };

function isForbidden(error: unknown) {
  return error instanceof Error && error.name === "CareerForbiddenError";
}

function publicMessage(error: unknown) {
  if (isForbidden(error)) return error instanceof Error ? error.message : "Acesso negado.";
  const message = error instanceof Error ? error.message : "";
  console.error(error);
  if (/migração|migration|schema cache|PGRST205|relation ["']?career_|could not find the table/i.test(message)) {
    return "Aplique a migração 0057_career_intelligence.sql no Supabase (e recarregue o schema se necessário).";
  }
  if (/Missing Supabase environment variable/i.test(message)) {
    return "Servidor sem SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (/e-mail|smtp|caixa de e-mail|CAREER_SMTP/i.test(message)) {
    return message;
  }
  if (!message || /postgres|PGRST|JWT|fetch failed/i.test(message)) {
    return "Não foi possível concluir. Tente de novo.";
  }
  return message;
}

async function guard<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (isForbidden(error)) {
      return { ok: false, message: publicMessage(error), status: 403 };
    }
    return { ok: false, message: publicMessage(error) };
  }
}

async function runCareer<T>(loader: () => Promise<T>): Promise<Result<T>> {
  try {
    return await guard(loader);
  } catch (error) {
    // Captura falha de import dinâmico / RPC antes do guard.
    return { ok: false, message: publicMessage(error) };
  }
}

export const careerAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<{ allowed: boolean }>> => {
    return runCareer(async () => {
      const { canAccessCareerPanel } = await import("@/server/career-access.server");
      return { allowed: await canAccessCareerPanel(context.userId) };
    });
  });

export const careerOverviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runCareer(async () => {
      const { careerOverview } = await import("@/server/career.server");
      return careerOverview(context.userId);
    });
  });

export const careerCompaniesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runCareer(async () => {
      const { listCareerCompanies } = await import("@/server/career.server");
      return listCareerCompanies(context.userId, { limit: 200, offset: 0 });
    });
  });

export const careerCompanyDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    return runCareer(async () => {
      const { getCareerCompanyDetail } = await import("@/server/career.server");
      return getCareerCompanyDetail(context.userId, data.id);
    });
  });

export const recordManualCareerApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { companyId: string; jobId?: string; title?: string; url?: string; notes?: string }) => data,
  )
  .handler(async ({ context, data }) => {
    return runCareer(async () => {
      const { recordManualCareerApplication } = await import("@/server/career.server");
      return recordManualCareerApplication(context.userId, data);
    });
  });

export const careerJobsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runCareer(async () => {
      const { listCareerJobs } = await import("@/server/career.server");
      return listCareerJobs(context.userId, { limit: 200, offset: 0 });
    });
  });

export const careerContactsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runCareer(async () => {
      const { listCareerContacts } = await import("@/server/career.server");
      return listCareerContacts(context.userId, { limit: 200, offset: 0 });
    });
  });

export const careerApplicationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runCareer(async () => {
      const { listCareerApplications } = await import("@/server/career.server");
      return listCareerApplications(context.userId);
    });
  });

export const careerHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runCareer(async () => {
      const { listCareerHistory } = await import("@/server/career.server");
      return listCareerHistory(context.userId);
    });
  });

export const approveCareerApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    return runCareer(async () => {
      const { patchCareerApplication } = await import("@/server/career.server");
      return patchCareerApplication(context.userId, data.id, { status: "approved" });
    });
  });

export const sendCareerApplicationEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; toEmail?: string }) => data)
  .handler(async ({ context, data }) => {
    return runCareer(async () => {
      const { sendCareerApplicationEmail } = await import("@/server/career.server");
      return sendCareerApplicationEmail(context.userId, data.id, data.toEmail);
    });
  });
