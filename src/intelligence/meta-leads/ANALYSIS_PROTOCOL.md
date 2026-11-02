# NEX Intelligence — Protocolo de Análise Meta Ads v1.1.1

Protocolo analítico Meta-only (linha 1.1) com motor de integridade **1.1.1**.

## Escopo

Fonte exclusiva: **Meta Marketing API** (contrato NEX Meta Analysis V1, `data_contract_version` 1.0.0).

Níveis: Campanha, Conjunto e Anúncio. Não altera a Meta. `null` ≠ `0`.

## Fonte de dados

Não depender de vendas, CRM, chatbot, agendamentos ou dados manuais. Ausência desses dados **não** gera alertas.

## Integridade (motor 1.1.1)

Antes da IA, o NEX executa validação determinística (`data_quality`) e calcula totais (`computed_metrics`).

Estados: `PASS`, `WARNING`, `FAIL`, `NOT_VERIFIABLE`.

A IA não declara integridade completa diante de inconsistências. Recomendações prescritivas não usam métricas comprometidas.

## Interpretação e recomendações

Interpretar o evento Meta reportado. Recomendações com múltiplas evidências, IDs e grau de confiança.
