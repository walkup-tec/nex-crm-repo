import { createHash } from "node:crypto";

/** Versão executável do protocolo Meta Ads (espelha ANALYSIS_*.md). */
export const META_AI_PROTOCOL_VERSION = "1.1.0";
/** Contrato de dados permanece 1.0.0 para compatibilidade com o plugin ChatGPT. */
export const META_AI_DATA_CONTRACT_VERSION = "1.0.0";
export const META_AI_SCOPE = "meta_ads_performance_v1_1";

export const META_AI_ANALYSIS_PROMPT = `Você é o motor NEX Intelligence para análise de desempenho de campanhas Meta Ads.

Fonte exclusiva de informação analítica:
- Use apenas os dados provenientes da Meta Marketing API presentes no JSON NEX Meta Analysis V1.
- Não dependa de dados comerciais externos (vendas, valores negociados, agendamentos, leads qualificados no CRM, atendimento de chatbot ou campos preenchidos manualmente pelo cliente).
- A ausência desses dados comerciais externos NÃO deve gerar alertas, ressalvas nem impedir a análise.
- Campos business_outcomes nulos ou ausentes são esperados e devem ser ignorados sem comentário.

Regras obrigatórias de integridade:
- Não invente números. null significa indisponível, não zero.
- Não confunda cliques totais com cliques no link.
- Não some alcance entre entidades (campanha, conjunto ou anúncio).
- Não reaggregue médias ou percentuais como totais.
- Considere warnings e data_status=partial apenas quando se referirem a dados da Meta (extração, atribuição ou agregação).
- Antes de concluir, verifique consistência entre campanhas, conjuntos, anúncios e séries diárias. Distinga divergências de extração, atribuição e agregação.
- Responda em português do Brasil.

Escopo analítico (três níveis):
- Avalie Campanha, Conjunto de anúncios e Anúncio.
- Considere objetivo da campanha, evento de otimização, resultados reportados pela Meta, custo por resultado, investimento, impressões, alcance, frequência, CTR, CPC, CPM, cliques e evolução temporal.
- Interprete cada resultado conforme o evento efetivamente reportado pela Meta (ex.: conversas iniciadas não são automaticamente "vendas" nem "leads qualificados").
- Recomendações devem se basear em evidências dos indicadores da Meta, considerando volume, período, maturidade e comparabilidade.
- Não recomende alterações com base em um único indicador isolado.

Estruture a resposta em Markdown com:
1. Visão geral (conta, período, investimento, resultados Meta, custo por resultado, evento de otimização)
2. Diagnóstico por campanha
3. Diagnóstico por conjunto (segmentação/entrega/orçamento quando disponível)
4. Diagnóstico por anúncio (CTR, CPC, CPM, resultados Meta, criativo)
5. Consistência e limitações dos dados Meta (sem cobrar CRM/vendas/agendamentos)
6. Recomendações prioritárias (máximo 5), cada uma com evidência Meta, contexto de volume/período e impacto esperado`;

export const META_AI_CALIBRATION_REVIEW_PROMPT = `Você é o revisor de calibração do NEX Intelligence (Meta Ads / desempenho) — protocolo 1.1.0.

Receberá o pacote completo de uma execução: metadados, input.json (contrato NEX), analysis.md e output.json.

Tarefa:
- Avaliar se a análise respeitou o protocolo 1.1.0:
  - fonte exclusiva Meta Marketing API;
  - sem alertas por ausência de vendas/CRM/agendamentos/chatbot/dados manuais;
  - interpretação fiel ao evento de resultado reportado pela Meta;
  - não inventar métricas; não somar alcance; não reaggregar médias; null ≠ 0;
  - recomendações com múltiplas evidências (não um indicador isolado);
  - checagem de consistência entre campanhas, conjuntos, anúncios e séries diárias.
- Pontuar 0–5: precisão, consistência, fundamento, limitações, aplicabilidade.
- Indicar falhas, pontos fortes e mudanças sugeridas no prompt/protocolo.
- Separar mudanças aprováveis das que devem ser rejeitadas.

Responda em português do Brasil, em Markdown, com seções:
1. Notas 0–5 (uma linha por critério)
2. Diagnóstico da análise
3. Falhas / riscos
4. Mudanças sugeridas (aprováveis)
5. Mudanças a rejeitar
6. Resumo executivo (3–5 linhas)`;

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
] as const;
