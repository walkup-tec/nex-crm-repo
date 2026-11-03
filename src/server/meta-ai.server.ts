import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clampScore,
  type MetaAiAnalysisStartResult,
  type MetaAiCalibrationFeedback,
  type MetaAiExecutionDetail,
  type MetaAiExecutionStatus,
  type MetaAiExecutionSummary,
} from "@/lib/meta-ai-calibration";
import { metaAiCalibrationReviewUserPrompt } from "@/lib/meta-ai-prompt";
import {
  META_AI_ANALYSIS_PROMPT,
  META_AI_CALIBRATION_REVIEW_PROMPT,
  META_AI_DATA_CONTRACT_VERSION,
  META_AI_ENGINE_VERSION,
  META_AI_PROTOCOL_VERSION,
  META_AI_REGENERATION_PROMPT,
  META_AI_STRUCTURAL_REGENERATION_PROMPT,
  metaAiPromptHash,
} from "@/intelligence/meta-leads/protocol";
import { attachDataQuality, validateMetaAnalysisData } from "@/lib/meta-data-quality";
import { runMetaAnalysis } from "@/lib/nex-intelligence/pipeline/run-meta-analysis";
import {
  toMetaAiExecutionDetail,
  toMetaAiExecutionSummary,
} from "@/lib/nex-intelligence/persistence/map-row";
import { exportMetaAnalysis } from "@/server/meta.server";
import { requestOpenAiAnalysis } from "@/server/openai.server";

export type { MetaAiAnalysisStartResult };

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
    fail("Só o Master acessa o Laboratório de Calibração.");
  }
}

function migrationHint(message: string) {
  if (/meta_ai_executions_status_check|status.*running/i.test(message)) {
    return "Aplique a migração 0050_meta_ai_executions_running.sql no Supabase (status running).";
  }
  if (/meta_ai_executions|schema cache|does not exist/i.test(message)) {
    return "Aplique a migração 0049_meta_ai_executions.sql no Supabase para gravar as execuções.";
  }
  return message;
}

type AnalyzeInput = { organizationId: string; period?: string; since?: string; until?: string };

async function resolveClientName(organizationId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("legal_name, commercial_name")
    .eq("id", organizationId)
    .maybeSingle();
  return String(data?.commercial_name || data?.legal_name || "").trim();
}

async function runAndPersistAnalysis(executionId: string, userId: string, input: AnalyzeInput) {
  const promptHash = metaAiPromptHash();
  try {
    const rawPayload = await exportMetaAnalysis(userId, input);
    const quality = validateMetaAnalysisData(rawPayload, {
      protocolVersion: META_AI_PROTOCOL_VERSION,
      engineVersion: META_AI_ENGINE_VERSION,
    });
    const payload = attachDataQuality(rawPayload, quality);

    const run = await runMetaAnalysis({
      payload,
      quality,
      promptHash,
      analysisSystemPrompt: META_AI_ANALYSIS_PROMPT,
      structuralSystemPrompt: META_AI_STRUCTURAL_REGENERATION_PROMPT,
      regenerationSystemPrompt: META_AI_REGENERATION_PROMPT,
      requestOpenAi: (req) => requestOpenAiAnalysis(req),
    });

    const status: MetaAiExecutionStatus = run.executionStatus;
    const { error } = await supabaseAdmin
      .from("meta_ai_executions")
      .update({
        status,
        data_contract_version: META_AI_DATA_CONTRACT_VERSION,
        protocol_version: META_AI_PROTOCOL_VERSION,
        prompt_hash: promptHash,
        model: run.model,
        account_id: payload.account.id,
        account_name: payload.account.name,
        client_name: payload.metadata.client_name,
        period_since: payload.period.since,
        period_until: payload.period.until,
        period_timezone: payload.period.timezone,
        input_json: payload,
        output_json: run.outputJson,
        analysis_markdown: run.processed.publishedMarkdown,
        warnings: payload.warnings,
        error_message: run.errorMessage || (status === "error" ? "Falha na OpenAI." : ""),
      })
      .eq("id", executionId);

    if (error) {
      console.error("meta_ai_persist_update", migrationHint(error.message));
      await supabaseAdmin
        .from("meta_ai_executions")
        .update({
          status: "error",
          error_message: migrationHint(error.message),
          prompt_hash: promptHash,
        })
        .eq("id", executionId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na análise Meta IA.";
    console.error("meta_ai_background", /access_token|EAA[A-Za-z0-9]/.test(message) ? "redacted" : message);
    await supabaseAdmin
      .from("meta_ai_executions")
      .update({
        status: "error",
        error_message: message.slice(0, 800),
        prompt_hash: promptHash,
      })
      .eq("id", executionId);
  }
}

/**
 * Start assíncrono: grava execução `running` e devolve o UUID imediatamente.
 * O trabalho pesado (export Meta + OpenAI) continua no processo Node sem segurar o proxy.
 */
export async function startMetaAiAnalysis(
  userId: string,
  input: AnalyzeInput,
): Promise<MetaAiAnalysisStartResult> {
  await assertMaster(userId);
  const promptHash = metaAiPromptHash();
  const clientName = await resolveClientName(input.organizationId);
  const periodSince = input.period === "custom" && input.since ? input.since : null;
  const periodUntil = input.period === "custom" && input.until ? input.until : null;

  const { data, error } = await supabaseAdmin
    .from("meta_ai_executions")
    .insert({
      organization_id: input.organizationId,
      actor_id: userId,
      status: "running",
      data_contract_version: META_AI_DATA_CONTRACT_VERSION,
      protocol_version: META_AI_PROTOCOL_VERSION,
      prompt_hash: promptHash,
      model: "",
      account_id: "",
      account_name: "",
      client_name: clientName,
      period_since: periodSince,
      period_until: periodUntil,
      period_timezone: "America/Sao_Paulo",
      input_json: {},
      output_json: {},
      analysis_markdown: "",
      warnings: [],
      error_message: "",
      calibration_feedback: {},
    })
    .select("id")
    .maybeSingle();

  if (error) fail(migrationHint(error.message));
  if (!data?.id) fail("Não foi possível iniciar a execução de análise.");

  void runAndPersistAnalysis(data.id, userId, input);

  return { executionId: data.id, status: "running" };
}

/** Alias do start assíncrono — o cliente deve fazer polling em getMetaAiExecution. */
export async function analyzeMetaWithAi(
  userId: string,
  input: AnalyzeInput,
): Promise<MetaAiAnalysisStartResult> {
  return startMetaAiAnalysis(userId, input);
}

export async function listMetaAiExecutions(
  userId: string,
  input: { organizationId?: string; limit?: number } = {},
): Promise<MetaAiExecutionSummary[]> {
  await assertMaster(userId);
  let query = supabaseAdmin
    .from("meta_ai_executions")
    .select(
      "id, created_at, status, organization_id, client_name, account_id, account_name, period_since, period_until, protocol_version, data_contract_version, model, prompt_hash, warnings",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, input.limit ?? 40)));
  if (input.organizationId) query = query.eq("organization_id", input.organizationId);
  const { data, error } = await query;
  if (error) fail(migrationHint(error.message));
  return (data ?? []).map((row) => toMetaAiExecutionSummary(row as Record<string, unknown>));
}

export async function getMetaAiExecution(
  userId: string,
  executionId: string,
): Promise<MetaAiExecutionDetail> {
  await assertMaster(userId);
  const { data, error } = await supabaseAdmin
    .from("meta_ai_executions")
    .select("*")
    .eq("id", executionId)
    .maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Execução não encontrada.");
  return toMetaAiExecutionDetail(data as Record<string, unknown>);
}

export async function saveMetaAiCalibrationFeedback(
  userId: string,
  input: { executionId: string; feedback: MetaAiCalibrationFeedback },
): Promise<MetaAiExecutionDetail> {
  await assertMaster(userId);
  const scores = input.feedback.scores
    ? {
        precision: clampScore(input.feedback.scores.precision),
        consistency: clampScore(input.feedback.scores.consistency),
        foundation: clampScore(input.feedback.scores.foundation),
        limitations: clampScore(input.feedback.scores.limitations),
        applicability: clampScore(input.feedback.scores.applicability),
      }
    : undefined;
  const feedback: MetaAiCalibrationFeedback = {
    ...input.feedback,
    scores,
    reviewed_at: new Date().toISOString(),
    reviewer: "master",
  };
  const { data, error } = await supabaseAdmin
    .from("meta_ai_executions")
    .update({ calibration_feedback: feedback })
    .eq("id", input.executionId)
    .select("*")
    .maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Execução não encontrada.");
  return toMetaAiExecutionDetail(data as Record<string, unknown>);
}

export async function reviewMetaAiCalibrationWithAi(
  userId: string,
  executionId: string,
): Promise<MetaAiExecutionDetail> {
  const detail = await getMetaAiExecution(userId, executionId);
  if (detail.status === "running") {
    fail("A execução ainda está em andamento. Aguarde a conclusão antes de revisar.");
  }
  if (!detail.analysisMarkdown.trim()) {
    fail("Esta execução ainda não tem análise para revisar.");
  }

  const ai = await requestOpenAiAnalysis({
    system: META_AI_CALIBRATION_REVIEW_PROMPT,
    user: metaAiCalibrationReviewUserPrompt(detail),
  });

  const feedback: MetaAiCalibrationFeedback = {
    ...detail.calibrationFeedback,
    ai_review: ai.text,
    ai_review_model: ai.model,
    ai_reviewed_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
    reviewer: "openai",
  };

  const { data, error } = await supabaseAdmin
    .from("meta_ai_executions")
    .update({ calibration_feedback: feedback })
    .eq("id", executionId)
    .select("*")
    .maybeSingle();
  if (error) fail(migrationHint(error.message));
  if (!data) fail("Execução não encontrada.");
  return toMetaAiExecutionDetail(data as Record<string, unknown>);
}
