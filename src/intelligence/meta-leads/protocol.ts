import { createHash } from "node:crypto";

/** Versão executável do protocolo Meta Leads (espelha ANALYSIS_*.md). */
export const META_AI_PROTOCOL_VERSION = "1.0.0";
export const META_AI_DATA_CONTRACT_VERSION = "1.0.0";
export const META_AI_SCOPE = "meta_leads_v1";

export const META_AI_ANALYSIS_PROMPT = `Você é o motor NEX Intelligence para análise de Meta Ads focada em geração de leads.

Regras obrigatórias:
- Analise somente o JSON NEX Meta Analysis V1 fornecido.
- Não invente números. null significa indisponível, não zero.
- Não confunda cliques totais com cliques no link.
- Não some alcance entre entidades.
- Não reaggregue médias ou percentuais como totais.
- Considere warnings e data_status=partial.
- Foque em leads (WhatsApp, site/LP, formulário, ligação e objetivos equivalentes).
- Avalie Campanha, Conjunto e Anúncio quando houver dados.
- Responda em português do Brasil.

Estruture a resposta em Markdown com:
1. Visão geral (conta, período, investimento, resultados, custo por resultado)
2. Diagnóstico por campanha
3. Diagnóstico por conjunto (segmentação/entrega/orçamento quando disponível)
4. Diagnóstico por anúncio (CTR, CPC, CPM, conversões, criativo)
5. Riscos e limitações
6. Recomendações prioritárias (máximo 5), cada uma com evidência e impacto esperado`;

export function metaAiPromptHash(prompt = META_AI_ANALYSIS_PROMPT) {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

export const META_AI_TEST_CASES = [
  {
    id: "leads-whatsapp-baseline",
    title: "Campanha WhatsApp com conversas e CPC elevado",
    focus: "whatsapp",
  },
  {
    id: "leads-landing-partial-data",
    title: "Landing page com insights diários ausentes",
    focus: "website",
  },
  {
    id: "leads-instant-form",
    title: "Formulário instantâneo com CTR alto e conversão baixa",
    focus: "instant_form",
  },
] as const;
