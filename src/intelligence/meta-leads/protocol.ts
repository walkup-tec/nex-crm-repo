import { createHash } from "node:crypto";

/** Versão do protocolo analítico Meta-only (docs ANALYSIS_*.md) — linha 1.1, release 1.1.4. */
export const META_AI_PROTOCOL_VERSION = "1.1.4";
/** Contrato de dados permanece 1.0.0 para compatibilidade com o plugin ChatGPT. */
export const META_AI_DATA_CONTRACT_VERSION = "1.0.0";
/** Versão do motor de processamento / validação determinística (pré + pós-IA). */
export const META_AI_ENGINE_VERSION = "1.1.4";
export const META_AI_SCOPE = "meta_ads_performance_v1_1";

export const META_AI_ANALYSIS_PROMPT = `Você é o motor NEX Intelligence para análise de desempenho de campanhas Meta Ads (protocolo 1.1.4 / motor 1.1.4).

Fonte exclusiva: dados da Meta Marketing API no JSON NEX Meta Analysis V1 (e campos opcionais data_quality / computed_metrics).
Não use vendas, CRM, chatbot, agendamentos, receita ou dados manuais. business_outcomes nulos são esperados — ignore sem comentário e sem alerta.

Responda SOMENTE com um único objeto JSON válido (sem markdown fora do JSON), no formato:
{
  "format": "nex_intelligence_analysis_v1_1_4",
  "stage1_markdown": "texto PT-BR da Etapa 1",
  "observations": [
    {
      "id": "obs-1",
      "entity_id": "ID Meta",
      "level": "campaign",
      "metrics_used": ["ctr"],
      "trace_ids": ["trace-001"],
      "claim_kind": "descriptive",
      "text": "observação factual"
    }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "entity_id": "ID Meta",
      "level": "campaign|adset|ad",
      "indicators_used": ["ctr","cpc"],
      "trace_ids": ["trace-001","trace-002"],
      "evidence": ["fato 1","fato 2"],
      "hypothesis": null,
      "confidence": "medium",
      "recommended_action": "ação",
      "action_kind": "test|monitor|scale_budget|pause|replace_creative|other",
      "validation_criterion": "como validar",
      "arbitrary_targets": [],
      "uses_external_commercial_data": false
    }
  ],
  "executive_points": [
    {
      "id": "exec-1",
      "entity_id": null,
      "level": "account",
      "metrics_used": ["ctr"],
      "trace_ids": ["trace-agg-1"],
      "claim_kind": "descriptive",
      "text": "ponto verificável"
    }
  ],
  "metric_traceability": {
    "version": "1.0",
    "records": [
      {
        "trace_id": "trace-001",
        "entity_level": "campaign",
        "entity_id": "ID",
        "metric": "ctr",
        "source": "META_MARKETING_API",
        "source_level": "campaign",
        "source_field": "insights.clicks",
        "period": { "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" },
        "calculation": {
          "type": "RATIO",
          "formula": "(clicks / impressions) * 100",
          "inputs": { "clicks": 0, "impressions": 0 },
          "result": 0
        },
        "validation": { "status": "PASS", "dependencies": ["clicks","impressions"], "check_codes": [], "reason": null },
        "used_by": ["obs-1"]
      }
    ]
  },
  "stage2_markdown": "",
  "stage4_markdown": ""
}

Regras de integridade matemática:
- CTR depende só de clicks e impressions — inconsistência em spend/results NÃO invalida CTR.
- CPC depende de spend e clicks; CPM de spend e impressions; CPR de spend e results.
- Proibido CTR agregado por média simples de percentuais.
- CTR agregado só com AGGREGATION: sum(clicks)/sum(impressions), cobertura full, entidades compatíveis.
- Toda conclusão numérica exige trace_ids válidos em metric_traceability.

## Etapa 1 — Validação dos dados
Interprete data_quality. Nunca declare integridade completa com WARNING/FAIL/NOT_VERIFIABLE.

## Etapa 2 — observations[]
claim_kind=descriptive para fatos; sem indirect_recommendation; sem juízos com métricas comprometidas.

## Etapa 3 — recommendations[]
Só métricas íntegras para a entidade; com trace_ids.

## Etapa 4 — executive_points[]
Sem média simples de CTR; sem ações rejeitadas.`;

export const META_AI_CALIBRATION_REVIEW_PROMPT = `Você é o revisor de calibração do NEX Intelligence (Meta Ads) — protocolo 1.1.4.

Verifique Meta-only, data_quality, computed_metrics, validação pós-IA, metric_traceability e dependências matemáticas (CTR ≠ spend/results).
Pontue 0–5: precisão, consistência, fundamento, limitações, aplicabilidade.
Responda em PT-BR.`;

export const META_AI_REGENERATION_PROMPT = `Você regenera recomendações NEX Intelligence rejeitadas (motor 1.1.4).
Responda SOMENTE com JSON: { "recommendations": [ ... ] } incluindo trace_ids.
Não invente substitutas sem evidência Meta verificável.`;

export function metaAiPromptHash(prompt = META_AI_ANALYSIS_PROMPT) {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

export const META_AI_TEST_CASES = [
  { id: "meta-whatsapp-conversations", title: "Campanha WhatsApp com conversas e CPC elevado", focus: "whatsapp" },
  { id: "meta-landing-partial-daily", title: "Landing page com insights diários ausentes", focus: "website" },
  { id: "meta-instant-form-ctr", title: "Formulário instantâneo com CTR alto e conversão baixa", focus: "instant_form" },
  { id: "meta-null-business-outcomes", title: "business_outcomes nulos não devem gerar alerta", focus: "integrity" },
  { id: "meta-data-quality-gate", title: "IA não declara consistência com data_quality WARNING", focus: "integrity" },
  { id: "meta-post-ai-recommendation-gate", title: "Validação pós-IA bloqueia escala com results comprometido", focus: "integrity" },
  { id: "meta-narrative-integrity-gate", title: "Etapas 2 e 4 não publicam juízos sobre métricas comprometidas", focus: "integrity" },
  { id: "meta-metric-dependency-traceability", title: "CTR independente de spend/results; CTR médio exige agregação ponderada", focus: "integrity" },
] as const;
