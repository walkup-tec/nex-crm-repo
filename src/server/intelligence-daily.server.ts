import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nexDeployStatus } from "@/lib/nex-deploy";
import {
  evaluateDailyEligibility,
  intelligenceReferenceDate,
  shouldRunDailyJobAt,
  type DailyEligibilityConnection,
  type DailyEligibilityOrg,
} from "@/lib/nex-intelligence/daily/eligibility";
import { startMetaAiAnalysis } from "@/server/meta-ai.server";

let started = false;
let running = false;
let lastSlotKey: string | null = null;

export type DailyJobOrgResult = {
  organizationId: string;
  clientName: string;
  status: "started" | "skipped" | "failed";
  reason?: string;
  executionId?: string;
};

function fail(message: string): never {
  throw new Error(message);
}

async function assertMaster(userId: string) {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("id, is_blocked").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);
  if (profileError) fail(profileError.message);
  if (roleError) fail("Não foi possível confirmar o acesso.");
  if (!profile) fail("Seu perfil ainda não está ligado a um acesso.");
  if (profile.is_blocked) fail("Este acesso está bloqueado.");
  if (!(roles ?? []).some((row) => row.role === "master")) {
    fail("Só o Master pode reprocessar a rotina diária.");
  }
}

async function resolveSystemActorId(): Promise<string> {
  const fromEnv = process.env.NEX_INTELLIGENCE_ACTOR_ID?.trim();
  if (fromEnv) return fromEnv;
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "master")
    .limit(1)
    .maybeSingle();
  if (error) fail(error.message);
  if (!data?.user_id) fail("Nenhum usuário master disponível para a rotina diária (NEX_INTELLIGENCE_ACTOR_ID).");
  return String(data.user_id);
}

async function loadCandidateOrgs(): Promise<{
  orgs: DailyEligibilityOrg[];
  connections: DailyEligibilityConnection[];
  names: Map<string, string>;
}> {
  const orgQuery = await supabaseAdmin
    .from("organizations")
    .select("id, legal_name, commercial_name, status, ads_meta");
  if (orgQuery.error) fail(orgQuery.error.message);

  const connQuery = await supabaseAdmin
    .from("meta_connections")
    .select("organization_id, status, access_token_encrypted");
  if (connQuery.error) fail(connQuery.error.message);

  const orgs: DailyEligibilityOrg[] = (orgQuery.data ?? []).map((row) => ({
    id: String(row.id),
    status: String(row.status ?? ""),
    adsMeta: row.ads_meta !== false,
    legalName: String(row.legal_name ?? ""),
  }));

  const connections: DailyEligibilityConnection[] = (connQuery.data ?? []).map((row) => ({
    organizationId: String(row.organization_id),
    status: String(row.status ?? ""),
    hasToken: Boolean(row.access_token_encrypted),
  }));

  const names = new Map(
    (orgQuery.data ?? []).map((row) => [
      String(row.id),
      String(row.commercial_name || row.legal_name || "").trim(),
    ]),
  );

  return { orgs, connections, names };
}

async function alreadyHasDailyExecution(organizationId: string, referenceDate: string) {
  const { data, error } = await supabaseAdmin
    .from("meta_ai_executions")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("period_since", referenceDate)
    .eq("period_until", referenceDate)
    .in("status", ["ok", "partial", "running"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) fail(error.message);
  return (data ?? []).some((row) => {
    // Preferir execuções do job; se houver qualquer análise do mesmo dia, evita duplicar.
    return Boolean(row.id);
  });
}

async function processOrganization(input: {
  actorId: string;
  organizationId: string;
  clientName: string;
  referenceDate: string;
  force?: boolean;
}): Promise<DailyJobOrgResult> {
  if (!input.force) {
    const exists = await alreadyHasDailyExecution(input.organizationId, input.referenceDate);
    if (exists) {
      return {
        organizationId: input.organizationId,
        clientName: input.clientName,
        status: "skipped",
        reason: "already_processed",
      };
    }
  }

  try {
    const { defaultDailyAnalysisObjectives } = await import(
      "@/lib/nex-intelligence/goals/defaults"
    );
    // Padrão documentado quando não há objetivos configurados por cliente.
    const startedRun = await startMetaAiAnalysis(
      input.actorId,
      {
        organizationId: input.organizationId,
        period: "custom",
        since: input.referenceDate,
        until: input.referenceDate,
        trigger: "daily_job",
        referenceDate: input.referenceDate,
        objectives: defaultDailyAnalysisObjectives(),
      },
      { skipMasterAssert: true },
    );
    return {
      organizationId: input.organizationId,
      clientName: input.clientName,
      status: "started",
      executionId: startedRun.executionId,
    };
  } catch (error) {
    return {
      organizationId: input.organizationId,
      clientName: input.clientName,
      status: "failed",
      reason: error instanceof Error ? error.message : "daily_job_failed",
    };
  }
}

export async function runIntelligenceDailyJob(options?: {
  force?: boolean;
  organizationId?: string;
  referenceDate?: string;
  actorUserId?: string;
}): Promise<{
  referenceDate: string;
  results: DailyJobOrgResult[];
}> {
  const referenceDate = options?.referenceDate ?? intelligenceReferenceDate();
  const actorId = options?.actorUserId ?? (await resolveSystemActorId());
  const { orgs, connections, names } = await loadCandidateOrgs();

  const results: DailyJobOrgResult[] = [];
  const reportIneligible = Boolean(options?.organizationId || options?.force);

  for (const org of orgs) {
    if (options?.organizationId && org.id !== options.organizationId) continue;
    const verdict = evaluateDailyEligibility(org, connections);
    if (!verdict.ok) {
      if (reportIneligible) {
        results.push({
          organizationId: org.id,
          clientName: names.get(org.id) || org.legalName,
          status: "skipped",
          reason: verdict.reason,
        });
      }
      continue;
    }

    const result = await processOrganization({
      actorId,
      organizationId: org.id,
      clientName: names.get(org.id) || org.legalName,
      referenceDate,
      force: options?.force,
    });
    results.push(result);
    // Isola clientes e reduz pressão na Meta/OpenAI.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return { referenceDate, results };
}

export async function reprocessIntelligenceDaily(
  userId: string,
  input?: { organizationId?: string; referenceDate?: string },
) {
  await assertMaster(userId);
  return runIntelligenceDailyJob({
    force: true,
    organizationId: input?.organizationId,
    referenceDate: input?.referenceDate,
    actorUserId: userId,
  });
}

export function startIntelligenceDailyRunner() {
  if (started) return;
  started = true;
  const tick = () => {
    if (nexDeployStatus().shuttingDown) return;
    if (running) return;
    const decision = shouldRunDailyJobAt(new Date(), { lastRunKey: lastSlotKey });
    if (!decision.run) return;
    running = true;
    lastSlotKey = decision.slotKey;
    void runIntelligenceDailyJob()
      .then((summary) => {
        console.info(
          "intelligence_daily",
          summary.referenceDate,
          `started=${summary.results.filter((row) => row.status === "started").length}`,
          `skipped=${summary.results.filter((row) => row.status === "skipped").length}`,
          `failed=${summary.results.filter((row) => row.status === "failed").length}`,
        );
      })
      .catch((error: unknown) => {
        console.error("intelligence_daily", error instanceof Error ? error.message : "falha");
      })
      .finally(() => {
        running = false;
      });
  };
  setTimeout(tick, 20_000).unref();
  setInterval(tick, 5 * 60_000).unref();
}
