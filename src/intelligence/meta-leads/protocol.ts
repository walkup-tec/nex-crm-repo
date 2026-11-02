import { createHash } from "node:crypto";

/** Versão do protocolo analítico Meta-only (docs ANALYSIS_*.md) — linha 1.1, release 1.1.7. */
export const META_AI_PROTOCOL_VERSION = "1.1.7";
/** Contrato de dados permanece 1.0.0 para compatibilidade com o plugin ChatGPT. */
export const META_AI_DATA_CONTRACT_VERSION = "1.0.0";
/** Versão do motor de processamento / validação determinística (pré + pós-IA). */
export const META_AI_ENGINE_VERSION = "1.1.7";
export const META_AI_SCOPE = "meta_ads_performance_v1_1";

export const META_AI_ANALYSIS_PROMPT = `Você é o motor NEX Intelligence para análise de desempenho de campanhas Meta Ads (protocolo 1.1.7 / motor 1.1.7).

Fonte exclusiva: dados da Meta Marketing API no JSON NEX Meta Analysis V1 (e campos opcionais data_quality / computed_metrics).
Não use vendas, CRM, chatbot, agendamentos, receita ou dados manuais. business_outcomes nulos são esperados — ignore sem comentário e sem alerta.

Responda SOMENTE com um único objeto JSON válido (sem markdown fora do JSON), no formato:
{
  "format": "nex_intelligence_analysis_v1_1_7",
  "stage1_markdown": "texto PT-BR da Etapa 1",
  "observations": [
    {
      "id": "obs-1",
      "entity_id": "ID Meta EXATO da entidade citada",
      "level": "campaign",
      "metrics_used": ["ctr"],
      "trace_ids": ["trace-001"],
      "claim_kind": "descriptive",
      "text": "observação factual citando o nome correto da mesma entidade"
    }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "entity_id": "ID Meta EXATO",
      "level": "campaign",
      "indicators_used": ["ctr", "cpc"],
      "evidence": ["evidência 1", "evidência 2"],
      "hypothesis": null,
      "confidence": "medium",
      "recommended_action": "ação concreta",
      "action_kind": "monitor",
      "validation_criterion": "como validar",
      "trace_ids": ["trace-001"]
    }
  ],
  "executive_points": [ /* mesmo schema de observations */ ],
  "metric_traceability": {
    "version": "1.0",
    "records": [
      {
        "trace_id": "trace-001",
        "entity_level": "campaign",
        "entity_id": "MESMO ID da observation",
        "metric": "ctr",
        "source": "META_MARKETING_API",
        "source_level": "campaign",
        "source_field": "insights.clicks",
        "period": { "since": "igual ao period do export", "until": "igual ao period do export" },
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

Enums obrigatórios (valores exatos):
- action_kind: scale_budget | pause | replace_creative | test | monitor | other
- confidence: low | medium | high
- claim_kind: descriptive | performance_judgment | indirect_recommendation
- level (recs): campaign | adset | ad
- validation.status: PASS | WARNING | FAIL | NOT_VERIFIABLE
- calculation.type: DIRECT | RATIO | AGGREGATION | OTHER

Regras obrigatórias 1.1.7 (evidência objetiva E0–E3):
- Fatos numéricos rastreáveis = E1; classificações qualitativas exigem comparação E2; intervenções (test/replace_creative/scale/pause) exigem E3 com hipótese + critério + comparação compatível.
- CTR isolado NÃO autoriza otimização de criativo nem escala de orçamento; monitor=E1 permitido.
- Sem benchmarks inventados nem causalidade prometida.

Regras de vínculo 1.1.5–1.1.6:
- Se uma seção falhar schema, as demais ainda devem ser emitidas corretamente.
- entity_id da observation/recommendation DEVE ser o ID Meta da entidade nomeada no texto.
- Cada trace_id DEVE apontar para o MESMO entity_id da conclusão que o usa.
- Nunca associe métricas de "Nex Ads [Conv. Site]" a texto sobre "Nex Ads [Eng. WhatsApp]" (ou qualquer outro par distinto).
- period do trace = period do export desta execução.
- inputs/result devem refletir insights Meta dessa entidade; o NEX recalcula e rejeita divergências.
- O NEX ignora PASS inventado se a validação determinística falhar.

Regras de integridade matemática (1.1.4+):
- CTR ← clicks/impressions; CPC ← spend/clicks; CPM ← spend/impressions; CPR ← spend/results.
- Proibido CTR agregado por média simples; agregado só sum(clicks)/sum(impressions) com cobertura full.`;

export const META_AI_CALIBRATION_REVIEW_PROMPT = `Você é o revisor de calibração do NEX Intelligence (Meta Ads) — protocolo 1.1.7.

Verifique Meta-only, data_quality, metric_traceability, vínculo entity_id↔nome↔trace e dependências matemáticas.
Pontue 0–5: precisão, consistência, fundamento, limitações, aplicabilidade.
Responda em PT-BR.`;

export const META_AI_REGENERATION_PROMPT = `Você regenera recomendações NEX Intelligence rejeitadas (motor 1.1.7).
Responda SOMENTE com JSON: { "recommendations": [ ... ] } incluindo trace_ids no entity_id correto.
action_kind ∈ scale_budget|pause|replace_creative|test|monitor|other; confidence ∈ low|medium|high.
Não invente substitutas sem evidência Meta verificável.`;

export const META_AI_STRUCTURAL_REGENERATION_PROMPT = `Você corrige uma resposta estruturada inválida do NEX Intelligence (motor 1.1.7).
Responda SOMENTE com o objeto JSON COMPLETO no format nex_intelligence_analysis_v1_1_7.
Corrija os campos/paths inválidos indicados. Preserve seções já válidas. Meta-only. Sem markdown fora do JSON.`;

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
  { id: "meta-entity-trace-binding", title: "Trace de Conv. Site não pode aprovar observação de Eng. WhatsApp", focus: "integrity" },
  { id: "meta-schema-partial-recovery", title: "Falha de schema em recomendações não descarta observações válidas", focus: "integrity" },
  { id: "meta-objective-evidence-gate", title: "Evidência objetiva E0–E3 bloqueia CTR qualitativo e intervenção só com CTR", focus: "integrity" },
] as const;
