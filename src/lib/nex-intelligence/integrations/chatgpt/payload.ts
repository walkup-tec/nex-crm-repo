import {
  META_AI_ANALYSIS_PROMPT,
  META_AI_DATA_CONTRACT_VERSION,
  META_AI_PROTOCOL_VERSION,
} from "@/intelligence/meta-leads/protocol";
import type { MetaAiExecutionDetail } from "@/lib/meta-ai-calibration";
import { metaAiUserPrompt } from "@/lib/meta-ai-prompt";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { PersistedAnalyticalOutputV120 } from "@/lib/nex-intelligence/pipeline/persistence-contract";
import {
  CHATGPT_META_ANALYSIS_TOOL,
  scrubSensitive,
} from "@/lib/chatgpt-integration.helpers";

export type ChatgptMetaAnalysisPayload = {
  tool: typeof CHATGPT_META_ANALYSIS_TOOL;
  execution_id: string;
  created_at: string;
  status: string;
  organization_id: string;
  client_name: string;
  account: { id: string; name: string };
  period: { since: string | null; until: string | null; timezone: string };
  metadata: Record<string, unknown>;
  attribution: { setting: string | null; note: string } | null;
  campaigns: unknown[];
  adsets: unknown[];
  ads: unknown[];
  business_outcomes: Record<string, unknown> | null;
  ai_analysis: {
    markdown: string | null;
    model: string;
    output: Record<string, unknown>;
  };
  /** Evidências persistidas v1.2.0 — read-only (sem revalidação). */
  analytical_evidences: {
    validation: PersistedAnalyticalOutputV120["validation"] | null;
    rejected: PersistedAnalyticalOutputV120["rejected"] | null;
    recovery: PersistedAnalyticalOutputV120["recovery"] | null;
    metric_traceability: PersistedAnalyticalOutputV120["metric_traceability"] | null;
    ai_original: PersistedAnalyticalOutputV120["ai_original"] | null;
    report: PersistedAnalyticalOutputV120["report"] | null;
  };
  analysis_prompt: {
    system: string;
    user: string | null;
    prompt_hash: string;
    protocol_version: string;
    data_contract_version: string;
  };
  protocol_version: string;
  data_contract_version: string;
  warnings: string[];
  error_message: string | null;
  availability: {
    input_json: boolean;
    analysis_markdown: boolean;
    output_json: boolean;
  };
};

function asInput(detail: MetaAiExecutionDetail): NexMetaAnalysisV1 | null {
  const raw = detail.inputJson;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<NexMetaAnalysisV1>;
  if (!row.account || !Array.isArray(row.campaigns)) return null;
  return scrubSensitive(raw as NexMetaAnalysisV1);
}

function readPersistedOutput(output: Record<string, unknown>): Partial<PersistedAnalyticalOutputV120> {
  return output as Partial<PersistedAnalyticalOutputV120>;
}

export function buildChatgptMetaAnalysisPayload(
  detail: MetaAiExecutionDetail,
): ChatgptMetaAnalysisPayload {
  const input = asInput(detail);
  const hasAnalysis = Boolean(detail.analysisMarkdown?.trim());
  const output =
    detail.outputJson && typeof detail.outputJson === "object"
      ? scrubSensitive(detail.outputJson)
      : {};
  const persisted = readPersistedOutput(output as Record<string, unknown>);

  return {
    tool: CHATGPT_META_ANALYSIS_TOOL,
    execution_id: detail.id,
    created_at: detail.createdAt,
    status: detail.status,
    organization_id: detail.organizationId,
    client_name: detail.clientName || input?.metadata.client_name || "",
    account: {
      id: detail.accountId || input?.account.id || "",
      name: detail.accountName || input?.account.name || "",
    },
    period: {
      since: detail.periodSince ?? input?.period.since ?? null,
      until: detail.periodUntil ?? input?.period.until ?? null,
      timezone: detail.periodTimezone || input?.period.timezone || "America/Sao_Paulo",
    },
    metadata: scrubSensitive({
      source: input?.metadata.source ?? "NEX",
      exported_at: input?.metadata.exported_at ?? null,
      currency: input?.metadata.currency ?? null,
      data_status: input?.metadata.data_status ?? null,
      organization_id: detail.organizationId,
      client_name: detail.clientName || input?.metadata.client_name || "",
      model: detail.model,
      prompt_hash: detail.promptHash,
      schema_version: input?.schema_version ?? null,
      analytical_status: persisted.analytical_status ?? null,
    }),
    attribution: input?.attribution
      ? scrubSensitive(input.attribution)
      : { setting: null, note: "Atribuição não persistida nesta execução." },
    campaigns: input?.campaigns ?? [],
    adsets: input?.adsets ?? [],
    ads: input?.ads ?? [],
    business_outcomes: input?.business_outcomes ? scrubSensitive(input.business_outcomes) : null,
    ai_analysis: {
      markdown: hasAnalysis ? detail.analysisMarkdown : null,
      model: detail.model,
      output,
    },
    analytical_evidences: {
      validation: persisted.validation ?? null,
      rejected: persisted.rejected ?? null,
      recovery: persisted.recovery ?? null,
      metric_traceability: persisted.metric_traceability ?? null,
      ai_original: persisted.ai_original ?? null,
      report: persisted.report ?? null,
    },
    analysis_prompt: {
      system: META_AI_ANALYSIS_PROMPT,
      user: input ? metaAiUserPrompt(input) : null,
      prompt_hash: detail.promptHash,
      protocol_version: detail.protocolVersion || META_AI_PROTOCOL_VERSION,
      data_contract_version: detail.dataContractVersion || META_AI_DATA_CONTRACT_VERSION,
    },
    protocol_version: detail.protocolVersion || META_AI_PROTOCOL_VERSION,
    data_contract_version: detail.dataContractVersion || META_AI_DATA_CONTRACT_VERSION,
    warnings: detail.warnings ?? [],
    error_message: detail.errorMessage?.trim() ? detail.errorMessage : null,
    availability: {
      input_json: Boolean(input),
      analysis_markdown: hasAnalysis,
      output_json: Object.keys(output).length > 0,
    },
  };
}
