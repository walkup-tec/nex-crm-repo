# ANALYSIS_CHANGELOG — Meta Ads

## 1.1.1 — 2026-11-02

- Motor de processamento **1.1.1** com validação determinística (`data_quality`) pré-IA.
- Totais financeiros em centavos (`computed_metrics.spend_total`).
- Prompt em 4 etapas: validação → análise → recomendações condicionadas → resumo.
- Melhora paginação/status na extração Meta; registra truncamento.
- Protocolo analítico Meta-only permanece a linha 1.1; contrato de dados **1.0.0**.
- IA não deve declarar consistência quando houver WARNING/FAIL/NOT_VERIFIABLE.

## 1.1.0 — 2026-11-02

- Redefine o motor como análise de desempenho Meta Ads (não depende de CRM/vendas).
- Fonte exclusiva: Meta Marketing API / contrato NEX Meta Analysis V1.
- Ausência de business_outcomes ou dados comerciais externos não gera alerta.
- Exige interpretação fiel ao evento de resultado reportado pela Meta.
- Fortalece checagem de consistência entre campanhas, conjuntos, anúncios e séries diárias.
- Recomendações com múltiplas evidências (proíbe decisão por indicador isolado).
- Contrato de dados permanece `1.0.0` (compatível com o plugin ChatGPT).

## 1.0.0 — 2026-11-02

- Versão inicial do protocolo de calibração para geração de leads.
- Prompt alinhado ao contrato NEX Meta Analysis V1.
- Escopo: WhatsApp, website/LP, formulários, ligação e objetivos equivalentes.
- Sem alteração automática de campanhas na Meta.
