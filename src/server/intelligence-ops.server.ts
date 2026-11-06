import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SuggestedTask } from "@/lib/nex-intelligence/dashboard/types";

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
    fail("Só o Master acessa o NEX Intelligence operacional.");
  }
}

function migrationHint(message: string) {
  if (/nex_optimization_|schema cache|does not exist/i.test(message)) {
    return "Aplique a migração 0052_nex_intelligence_optimizations.sql no Supabase.";
  }
  return message;
}

type TaskRow = {
  id: string;
  claim_id: string;
  title: string;
  justification: string;
  priority: "high" | "medium" | "low";
  evidence_level: string | null;
  kind: SuggestedTask["kind"];
  entity_level: string | null;
  entity_id: string | null;
  status: SuggestedTask["status"];
  updated_at: string;
};

function rowToTask(row: TaskRow): SuggestedTask {
  return {
    id: row.id,
    claimId: row.claim_id,
    title: row.title,
    justification: row.justification,
    priority: row.priority,
    evidenceLevel:
      row.evidence_level === "E0" ||
      row.evidence_level === "E1" ||
      row.evidence_level === "E2" ||
      row.evidence_level === "E3"
        ? row.evidence_level
        : null,
    kind: row.kind,
    entityLevel: row.entity_level,
    entityId: row.entity_id,
    status: row.status,
    appliedAt: row.status === "APPLIED" ? row.updated_at : null,
  };
}

export async function syncOptimizationTasksFromSuggestions(
  userId: string,
  input: {
    executionId: string;
    organizationId: string;
    adAccountId: string;
    tasks: SuggestedTask[];
  },
): Promise<SuggestedTask[]> {
  await assertMaster(userId);
  if (!input.tasks.length) {
    const { data, error } = await supabaseAdmin
      .from("nex_optimization_tasks")
      .select("*")
      .eq("execution_id", input.executionId)
      .order("created_at", { ascending: true });
    if (error) fail(migrationHint(error.message));
    return ((data ?? []) as TaskRow[]).map(rowToTask);
  }

  for (const task of input.tasks) {
    const existing = await supabaseAdmin
      .from("nex_optimization_tasks")
      .select("id")
      .eq("execution_id", input.executionId)
      .eq("claim_id", task.claimId)
      .maybeSingle();
    if (existing.error) fail(migrationHint(existing.error.message));
    if (existing.data?.id) continue;

    const { error } = await supabaseAdmin.from("nex_optimization_tasks").insert({
      execution_id: input.executionId,
      organization_id: input.organizationId,
      ad_account_id: input.adAccountId,
      entity_level: task.entityLevel ?? "campaign",
      entity_id: task.entityId,
      claim_id: task.claimId,
      title: task.title,
      justification: task.justification,
      priority: task.priority,
      evidence_level: task.evidenceLevel,
      kind: task.kind,
      status: "PENDING",
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      fail(migrationHint(error.message));
    }
  }

  const { data, error } = await supabaseAdmin
    .from("nex_optimization_tasks")
    .select("*")
    .eq("execution_id", input.executionId)
    .order("created_at", { ascending: true });
  if (error) fail(migrationHint(error.message));
  return ((data ?? []) as TaskRow[]).map(rowToTask);
}

export async function decideOptimizationTask(
  userId: string,
  input: {
    taskId: string;
    decision: "APPLIED" | "REJECTED";
    note?: string;
    effectiveAt?: string;
    description?: string;
  },
): Promise<{ task: SuggestedTask; eventId: string | null }> {
  await assertMaster(userId);

  const { data: task, error: taskError } = await supabaseAdmin
    .from("nex_optimization_tasks")
    .select("*")
    .eq("id", input.taskId)
    .maybeSingle();
  if (taskError) fail(migrationHint(taskError.message));
  if (!task) fail("Tarefa não encontrada.");

  const now = new Date().toISOString();
  const effectiveAt = input.effectiveAt || now;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("nex_optimization_tasks")
    .update({ status: input.decision, updated_at: now })
    .eq("id", input.taskId)
    .select("*")
    .single();
  if (updateError) fail(migrationHint(updateError.message));

  const { error: decisionError } = await supabaseAdmin.from("nex_optimization_decisions").insert({
    task_id: input.taskId,
    decision: input.decision,
    decided_by: userId,
    decided_at: now,
    note: input.note ?? "",
    effective_at: input.decision === "APPLIED" ? effectiveAt : null,
  });
  if (decisionError) fail(migrationHint(decisionError.message));

  let eventId: string | null = null;
  if (input.decision === "APPLIED") {
    const { data: event, error: eventError } = await supabaseAdmin
      .from("nex_optimization_events")
      .insert({
        organization_id: task.organization_id,
        ad_account_id: task.ad_account_id ?? "",
        campaign_id: task.entity_level === "campaign" ? task.entity_id : null,
        adset_id: task.entity_level === "adset" ? task.entity_id : null,
        ad_id: task.entity_level === "ad" ? task.entity_id : null,
        task_id: input.taskId,
        event_type: task.title,
        description: input.description || task.justification || task.title,
        effective_at: effectiveAt,
        recorded_at: now,
        responsible_user_id: userId,
        source: "ai_task",
        audit_json: { claim_id: task.claim_id, execution_id: task.execution_id },
      })
      .select("id")
      .single();
    if (eventError) fail(migrationHint(eventError.message));
    eventId = event?.id ?? null;
  }

  return { task: rowToTask(updated as TaskRow), eventId };
}

export async function listOptimizationEvents(
  userId: string,
  input: { organizationId: string; campaignId?: string; limit?: number },
) {
  await assertMaster(userId);
  let query = supabaseAdmin
    .from("nex_optimization_events")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("effective_at", { ascending: false })
    .limit(input.limit ?? 50);
  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);
  const { data, error } = await query;
  if (error) fail(migrationHint(error.message));
  return data ?? [];
}

export async function sendIntelligenceClientWhatsapp(
  userId: string,
  input: { organizationId: string; text: string },
) {
  await assertMaster(userId);
  const clean = input.text.trim();
  if (!clean) fail("Mensagem vazia.");

  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("id, finance_phone, responsible_phone")
    .eq("id", input.organizationId)
    .maybeSingle();
  if (error) fail(error.message);
  if (!org) fail("Cliente não encontrado.");

  const phone =
    String(org.finance_phone || "").trim() || String(org.responsible_phone || "").trim();
  if (!phone) fail("Cliente sem telefone WhatsApp cadastrado (financeiro/responsável).");

  const { sendPlainWhatsapp } = await import("@/server/evo.server");
  const sent = await sendPlainWhatsapp({ phone, text: clean });
  if (!sent.ok) fail(sent.error || "Falha ao enviar WhatsApp.");

  const { error: logError } = await supabaseAdmin.from("nex_client_communications").insert({
    organization_id: input.organizationId,
    event_ids: [],
    channel: "whatsapp",
    body: clean,
    status: "sent",
    idempotency_key: `intel-wa-${input.organizationId}-${Date.now()}`,
    created_by: userId,
    provider_ref: sent.messageId || null,
  });
  if (logError) {
    // Envio já ocorreu; não falha a UX por log.
    console.error("nex_client_communications", logError.message);
  }

  return { messageId: sent.messageId, phone };
}
