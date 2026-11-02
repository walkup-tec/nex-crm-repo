import { createHash } from "node:crypto";

/** Versão do protocolo analítico Meta-only (docs ANALYSIS_*.md) — linha 1.1, release 1.1.3. */
export const META_AI_PROTOCOL_VERSION = "1.1.3";
/** Contrato de dados permanece 1.0.0 para compatibilidade com o plugin ChatGPT. */
export const META_AI_DATA_CONTRACT_VERSION = "1.0.0";
/** Versão do motor de processamento / validação determinística (pré + pós-IA). */
export const META_AI_ENGINE_VERSION = "1.1.3";
export const META_AI_SCOPE = "meta_ads_performance_v1_1";

export const META_AI_ANALYSIS_PROMPT = `Você é o motor NEX Intelligence para análise de desempenho de campanhas Meta Ads (protocolo 1.1.3 / motor 1.1.3).

Fonte exclusiva: dados da Meta Marketing API no JSON NEX Meta Analysis V1 (e campos opcionais data_quality / computed_metrics).
Não use vendas, CRM, chatbot, agendamentos, receita ou dados manuais. business_outcomes nulos são esperados — ignore sem comentário e sem alerta.

Responda SOMENTE com um único objeto JSON válido (sem markdown fora do JSON), no formato:
{
  "format": "nex_intelligence_analysis_v1_1_3",
  "stage1_markdown": "texto PT-BR da Etapa 1 (interpretação de data_quality)",
  "observations": [
    {
      "id": "obs-1",
      "entity_id": "ID Meta ou null",
      "level": "account|campaign|adset|ad",
      "metrics_used": ["ctr","cpc"],
      "claim_kind": "descriptive|performance_judgment|indirect_recommendation",
      "text": "observação factual"
    }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "entity_id": "ID Meta",
      "level": "campaign|adset|ad",
      "indicators_used": ["spend","ctr"],
      "evidence": ["fato verificável 1","fato verificável 2"],
      "hypothesis": "hipótese ou null",
      "confidence": "low|medium|high",
      "recommended_action": "ação proposta",
      "action_kind": "scale_budget|pause|replace_creative|test|monitor|other",
      "validation_criterion": "como validar depois",
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
      "claim_kind": "descriptive",
      "text": "ponto de resumo verificável"
    }
  ],
  "stage2_markdown": "",
  "stage4_markdown": ""
}

Prefira observations[] e executive_points[] (conteúdo estruturado). stage2_markdown/stage4_markdown são fallback e serão sanitizados; o NEX NÃO publica Markdown bruto sem validação.

## Etapa 1 — Validação dos dados (stage1_markdown)
- Interprete obrigatoriamente o relatório determinístico em data_quality (se presente).
- Classifique métricas como confiáveis (verified_metrics), comprometidas (compromised_metrics) ou não verificáveis.
- Nunca declare integridade completa se data_quality.status for WARNING, FAIL ou NOT_VERIFIABLE, ou se houver checks nesses estados.
- Use computed_metrics.spend_total (quando presente) como investimento total da conta — não some manualmente com aritmética aproximada.

## Etapa 2 — Análise independente (observations[], só Meta)
Cada observação estruturada:
- claim_kind=descriptive para fatos verificáveis;
- NÃO use performance_judgment (desempenho insuficiente, conversão insatisfatória, ineficiência, retorno inadequado) com métricas comprometidas daquela entidade;
- NÃO inclua indirect_recommendation — ações só em recommendations[].
Se uma métrica estiver comprometida, ainda pode descrever outras métricas verificadas da mesma entidade.
Respeite: null ≠ 0; não some alcance; não reaggregue médias; interprete o evento Meta (conversa ≠ venda).

## Etapa 3 — Recomendações (array recommendations)
Cada item DEVE ser estruturado. indicators_used somente com métricas NÃO comprometidas para aquela entidade.
Proibido: scale_budget/pause/replace_creative com base em um único indicador ou em métrica comprometida.
Proibido: dados comerciais externos (CRM/vendas/receita).
O NEX validará determinísticamente e publicará apenas APPROVED.

## Etapa 4 — Resumo executivo (executive_points[])
Somente conclusões verificáveis. Sem recomendações indiretas. Sem julgamentos baseados em métricas comprometidas.
Não mencionar ausência de dados comerciais como deficiência.`;

export const META_AI_CALIBRATION_REVIEW_PROMPT = `Você é o revisor de calibração do NEX Intelligence (Meta Ads) — protocolo 1.1.3.

Receberá metadados, input.json (com data_quality/computed_metrics quando houver), analysis.md e output.json.

Verifique se a análise:
- respeitou Meta-only e não alertou por CRM/vendas;
- interpretou data_quality e não declarou consistência falsa;
- usou computed_metrics para totais financeiros quando disponível;
- evitou recomendações e conclusões prescritivas sobre métricas comprometidas nas etapas 2–4;
- não inventou métricas; não somou alcance; null ≠ 0;
- respeitou a validação pós-IA (recommendation_validation / narrative_sanitization) quando presente.

Pontue 0–5: precisão, consistência, fundamento, limitações, aplicabilidade.
Responda em PT-BR com: notas; diagnóstico; falhas; mudanças aprováveis; mudanças a rejeitar; resumo.`;

export const META_AI_REGENERATION_PROMPT = `Você regenera recomendações NEX Intelligence rejeitadas (motor 1.1.3).
Responda SOMENTE com JSON: { "recommendations": [ ... ] } no schema estruturado.
Não invente substitutas sem evidência Meta verificável. Não use métricas comprometidas nem dados comerciais externos.`;

export function metaAiPromptHash(prompt = META_AI_ANALYSIS_PROMPT) {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

export const META_AI_TEST_CASES = [
  {
    id: "meta-whatsapp-conversations",
    title: "Campanha WhatsApp com conversas e CPC elevado",
    focus: "whatsapp",
  },
  {
    id: "meta-landing-partial-daily",
    title: "Landing page com insights diários ausentes",
    focus: "website",
  },
  {
    id: "meta-instant-form-ctr",
    title: "Formulário instantâneo com CTR alto e conversão baixa",
    focus: "instant_form",
  },
  {
    id: "meta-null-business-outcomes",
    title: "business_outcomes nulos não devem gerar alerta",
    focus: "integrity",
  },
  {
    id: "meta-data-quality-gate",
    title: "IA não declara consistência com data_quality WARNING",
    focus: "integrity",
  },
  {
    id: "meta-post-ai-recommendation-gate",
    title: "Validação pós-IA bloqueia escala com results comprometido",
    focus: "integrity",
  },
  {
    id: "meta-narrative-integrity-gate",
    title: "Etapas 2 e 4 não publicam juízos sobre métricas comprometidas",
    focus: "integrity",
  },
] as const;
