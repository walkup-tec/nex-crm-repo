import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clampScore,
  type MetaAiAnalysisResult,
  type MetaAiCalibrationFeedback,
  type MetaAiExecutionDetail,
  type MetaAiExecutionStatus,
  type MetaAiExecutionSummary,
} from "@/lib/meta-ai-calibration";
import { metaAiUserPrompt } from "@/lib/meta-ai-prompt";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { zipToBase64 } from "@/lib/simple-zip";
import {
  META_AI_ANALYSIS_PROMPT,
  META_AI_DATA_CONTRACT_VERSION,
  META_AI_PROTOCOL_VERSION,
  metaAiPromptHash,
} from "@/intelligence/meta-leads/protocol";
import { exportMetaAnalysis } from "@/server/meta.server";
import { requestOpenAiAnalysis } from "@/server/openai.server";

export type { MetaAiAnalysisResult };

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
  if (/meta_ai_executions|schema cache|does not exist/i.test(message)) {
    return "Aplique a migração 0049_meta_ai_executions.sql no Supabase para gravar as execuções.";
  }
  return message;
}

function toSummary(row: Record<string, unknown>): MetaAiExecutionSummary {
  const warnings = Array.isArray(row.warnings) ? row.warnings : [];
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    status: (row.status as MetaAiExecutionStatus) || "ok",
    organizationId: String(row.organization_id),
    clientName: String(row.client_name ?? ""),
    accountId: String(row.account_id ?? ""),
    accountName: String(row.account_name ?? ""),
    periodSince: row.period_since ? String(row.period_since).slice(0, 10) : null,
    periodUntil: row.period_until ? String(row.period_until).slice(0, 10) : null,
    protocolVersion: String(row.protocol_version ?? ""),
    dataContractVersion: String(row.data_contract_version ?? ""),
    model: String(row.model ?? ""),
    promptHash: String(row.prompt_hash ?? ""),
    warningCount: warnings.length,
  };
}

function toDetail(row: Record<string, unknown>): MetaAiExecutionDetail {
  return {
    ...toSummary(row),
    periodTimezone: String(row.period_timezone ?? "America/Sao_Paulo"),
    analysisMarkdown: String(row.analysis_markdown ?? ""),
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    errorMessage: String(row.error_message ?? ""),
    inputJson: (row.input_json as NexMetaAnalysisV1) ?? {},
    outputJson: (row.output_json as Record<string, unknown>) ?? {},
    calibrationFeedback: (row.calibration_feedback as MetaAiCalibrationFeedback) ?? {},
  };
}

export async function analyzeMetaWithAi(
  userId: string,
  input: { organizationId: string; period?: string; since?: string; until?: string },
): Promise<MetaAiAnalysisResult> {
  await assertMaster(userId);
  const promptHash = metaAiPromptHash();
  const payload = await exportMetaAnalysis(userId, input);

  let analysis = "";
  let model = process.env["OPENAI_MODEL"]?.trim() || "gpt-4o-mini";
  let status: MetaAiExecutionStatus = payload.metadata.data_status === "partial" ? "partial" : "ok";
  let errorMessage = "";

  try {
    const ai = await requestOpenAiAnalysis({
      system: META_AI_ANALYSIS_PROMPT,
      user: metaAiUserPrompt(payload),
    });
    analysis = ai.text;
    model = ai.model;
  } catch (error) {
    status = "error";
    errorMessage = error instanceof Error ? error.message : "Falha na OpenAI.";
  }

  const outputJson = {
    analysis_markdown: analysis,
    model,
    protocol_version: META_AI_PROTOCOL_VERSION,
    prompt_hash: promptHash,
  };

  const { data, error } = await supabaseAdmin
    .from("meta_ai_executions")
    .insert({
      organization_id: input.organizationId,
      actor_id: userId,
      status,
      data_contract_version: META_AI_DATA_CONTRACT_VERSION,
      protocol_version: META_AI_PROTOCOL_VERSION,
      prompt_hash: promptHash,
      model,
      account_id: payload.account.id,
      account_name: payload.account.name,
      client_name: payload.metadata.client_name,
      period_since: payload.period.since,
      period_until: payload.period.until,
      period_timezone: payload.period.timezone,
      input_json: payload,
      output_json: outputJson,
      analysis_markdown: analysis,
      warnings: payload.warnings,
      error_message: errorMessage,
      calibration_feedback: {},
    })
    .select("id")
    .maybeSingle();

  if (error) fail(migrationHint(error.message));
  if (!data?.id) fail("Não foi possível gravar a execução de análise.");
  if (status === "error") fail(errorMessage || "Falha na OpenAI.");

  return {
    executionId: data.id,
    analysis,
    model,
    clientName: payload.metadata.client_name,
    accountId: payload.account.id,
    accountName: payload.account.name,
    period: payload.period,
    campaignCount: payload.campaigns.length,
    adsetCount: payload.adsets.length,
    adCount: payload.ads.length,
    warnings: payload.warnings,
    dataStatus: payload.metadata.data_status,
    protocolVersion: META_AI_PROTOCOL_VERSION,
    dataContractVersion: META_AI_DATA_CONTRACT_VERSION,
    promptHash,
  };
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
  return (data ?? []).map((row) => toSummary(row as Record<string, unknown>));
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
  return toDetail(data as Record<string, unknown>);
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
  return toDetail(data as Record<string, unknown>);
}

export async function exportMetaAiCalibrationPackage(
  userId: string,
  executionId: string,
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  const detail = await getMetaAiExecution(userId, executionId);
  const executionMetadata = {
    execution_id: detail.id,
    created_at: detail.createdAt,
    status: detail.status,
    organization_id: detail.organizationId,
    client_name: detail.clientName,
    account_id: detail.accountId,
    account_name: detail.accountName,
    period: {
      since: detail.periodSince,
      until: detail.periodUntil,
      timezone: detail.periodTimezone,
    },
    data_contract_version: detail.dataContractVersion,
    protocol_version: detail.protocolVersion,
    prompt_hash: detail.promptHash,
    model: detail.model,
    warnings: detail.warnings,
    error_message: detail.errorMessage || null,
  };

  const base64 = zipToBase64([
    { name: "input.json", content: JSON.stringify(detail.inputJson, null, 2) },
    { name: "output.json", content: JSON.stringify(detail.outputJson, null, 2) },
    { name: "analysis.md", content: detail.analysisMarkdown || "_Sem análise._\n" },
    { name: "execution_metadata.json", content: JSON.stringify(executionMetadata, null, 2) },
    {
      name: "calibration_feedback.json",
      content: JSON.stringify(detail.calibrationFeedback ?? {}, null, 2),
    },
  ]);

  const stamp = detail.createdAt.slice(0, 19).replace(/[:T]/g, "-");
  const account = detail.accountId.replace(/^act_/i, "") || "conta";
  return {
    fileName: `nex_calibration_${account}_${stamp}.zip`,
    base64,
    mimeType: "application/zip",
  };
}
