import { createHash } from "node:crypto";

/** Versão do protocolo analítico Meta-only (docs ANALYSIS_*.md). */
export const META_AI_PROTOCOL_VERSION = "1.1.1";
/** Contrato de dados permanece 1.0.0 para compatibilidade com o plugin ChatGPT. */
export const META_AI_DATA_CONTRACT_VERSION = "1.0.0";
/** Versão do motor de processamento / validação determinística. */
export const META_AI_ENGINE_VERSION = "1.1.1";
export const META_AI_SCOPE = "meta_ads_performance_v1_1";

export const META_AI_ANALYSIS_PROMPT = `Você é o motor NEX Intelligence para análise de desempenho de campanhas Meta Ads (protocolo 1.1.1 / motor 1.1.1).

Fonte exclusiva: dados da Meta Marketing API no JSON NEX Meta Analysis V1 (e campos opcionais data_quality / computed_metrics).
Não use vendas, CRM, chatbot, agendamentos, receita ou dados manuais. business_outcomes nulos são esperados — ignore sem comentário e sem alerta.

## Etapa 1 — Validação dos dados
- Interprete obrigatoriamente o relatório determinístico em data_quality (se presente).
- Classifique métricas como confiáveis (verified_metrics), comprometidas (compromised_metrics) ou não verificáveis.
- Nunca declare integridade completa se data_quality.status for WARNING, FAIL ou NOT_VERIFIABLE, ou se houver checks nesses estados.
- Use computed_metrics.spend_total (quando presente) como investimento total da conta — não some manualmente com aritmética aproximada.

## Etapa 2 — Análise independente (só Meta)
Analise campanhas, conjuntos e anúncios com:
objetivo, evento de otimização, tipo de resultado, investimento, resultados, custo por resultado, CTR, CPC, CPM, impressões, alcance, frequência, distribuição de investimento, evolução temporal, amostra e comparabilidade.
Respeite: null ≠ 0; não some alcance; não reaggregue médias; interprete o evento Meta (conversa ≠ venda).
Se uma métrica estiver comprometida, ainda pode analisar outras métricas verificadas da mesma entidade.

## Etapa 3 — Recomendações
Cada recomendação deve trazer:
- observação comprovada;
- entidade e ID;
- indicadores utilizados (somente métricas não comprometidas);
- hipótese explicativa (se houver);
- grau de confiança;
- ação ou teste proposto;
- métrica de validação;
- condição para considerar a recomendação válida.
Proibido: recomendar escala/pausa/troca de criativo com base em um único indicador ou em métrica comprometida (ex.: não escalar orçamento usando custo por resultado inconsistente).

## Etapa 4 — Resumo executivo
Inclua: diagnóstico geral; oportunidades; riscos de interpretação; problemas de integridade (data_quality); recomendações prioritárias; limitações só dos dados Meta.
Não mencionar ausência de dados comerciais como deficiência.

Responda em português do Brasil, em Markdown, com as seções das etapas 1–4.`;

export const META_AI_CALIBRATION_REVIEW_PROMPT = `Você é o revisor de calibração do NEX Intelligence (Meta Ads) — protocolo 1.1.1.

Receberá metadados, input.json (com data_quality/computed_metrics quando houver), analysis.md e output.json.

Verifique se a análise:
- respeitou Meta-only e não alertou por CRM/vendas;
- interpretou data_quality e não declarou consistência falsa;
- usou computed_metrics para totais financeiros quando disponível;
- evitou recomendações prescritivas sobre métricas comprometidas;
- não inventou métricas; não somou alcance; null ≠ 0.

Pontue 0–5: precisão, consistência, fundamento, limitações, aplicabilidade.
Responda em PT-BR com: notas; diagnóstico; falhas; mudanças aprováveis; mudanças a rejeitar; resumo.`;

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
] as const;
