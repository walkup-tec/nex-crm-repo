# NEX Intelligence — Protocolo de Análise Meta Ads v1.1.3

Protocolo analítico Meta-only (linha 1.1) com motor de integridade **1.1.3**.

## Escopo

Fonte exclusiva: **Meta Marketing API** (contrato NEX Meta Analysis V1, `data_contract_version` 1.0.0).

Níveis: Campanha, Conjunto e Anúncio. Não altera a Meta. `null` ≠ `0`.

## Fonte de dados

Não depender de vendas, CRM, chatbot, agendamentos ou dados manuais. Ausência desses dados **não** gera alertas.

## Integridade pré-IA (desde 1.1.1)

Antes da IA, o NEX executa validação determinística (`data_quality`) e calcula totais (`computed_metrics`).

Estados: `PASS`, `WARNING`, `FAIL`, `NOT_VERIFIABLE`.

## Validação pós-IA (1.1.2 → 1.1.3)

Após a resposta da OpenAI e antes da persistência:

1. Parse de análise estruturada (JSON + schema).
2. Validação determinística de recomendações e de claims narrativos (`observations`, `executive_points`).
3. Classificação `APPROVED` | `REJECTED` | `NEEDS_REVIEW`.
4. Publicação somente de conteúdo `APPROVED` no Markdown final (etapas 2–4).
5. Sanitização de fallback narrativo; Markdown bruto não é publicado diretamente.
6. Auditoria em `output_json.recommendation_validation` (inclui `narrative_sanitization`).

Bloqueio por entidade + métrica: divergência em uma campanha não invalida automaticamente outra campanha com métricas verificadas.

## Interpretação e recomendações

Interpretar o evento Meta reportado. Recomendações e conclusões com evidências verificáveis. Limiares arbitrários sem foundation são rejeitados ou enviados para revisão.
