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
  if (/career_|migração|migration/i.test(message)) {
    return "Aplique a migração 0057_career_intelligence.sql no Supabase.";
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

export const careerAccessFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<{ allowed: boolean }>> => {
    const { canAccessCareerPanel } = await import("@/server/career-access.server");
    return guard(async () => ({ allowed: await canAccessCareerPanel(context.userId) }));
  });

export const careerOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { careerOverview } = await import("@/server/career.server");
    return guard(() => careerOverview(context.userId));
  });

export const careerCompaniesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCareerCompanies } = await import("@/server/career.server");
    return guard(() => listCareerCompanies(context.userId));
  });

export const careerJobsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCareerJobs } = await import("@/server/career.server");
    return guard(() => listCareerJobs(context.userId));
  });

export const careerContactsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCareerContacts } = await import("@/server/career.server");
    return guard(() => listCareerContacts(context.userId));
  });

export const careerApplicationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCareerApplications } = await import("@/server/career.server");
    return guard(() => listCareerApplications(context.userId));
  });

export const careerHistoryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listCareerHistory } = await import("@/server/career.server");
    return guard(() => listCareerHistory(context.userId));
  });

export const approveCareerApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const { patchCareerApplication } = await import("@/server/career.server");
    return guard(() => patchCareerApplication(context.userId, data.id, { status: "approved" }));
  });
