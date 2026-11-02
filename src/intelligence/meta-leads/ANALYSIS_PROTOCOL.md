# NEX Intelligence — Protocolo de Análise Meta Ads v1.1.4

Protocolo analítico Meta-only (linha 1.1) com motor de integridade **1.1.4**.

## Escopo

Fonte exclusiva: **Meta Marketing API** (`data_contract_version` 1.0.0).

## Integridade por dependência

| Métrica | Dependências |
|---|---|
| CTR | clicks, impressions |
| CPC | spend, clicks |
| CPM | spend, impressions |
| CPR | spend, results |

Divergência em `spend`/`results` não compromete CTR. CPC/CPM avaliam spend separadamente.

## Rastreabilidade (`metric_traceability`)

Registros com entidade, origem Meta, fórmula, operandos, resultado e `validation.status`.
Conclusões numéricas referenciam `trace_ids`. CTR agregado: `AGGREGATION` ponderada, cobertura completa.

## Validação pós-IA

Preserva 1.1.1–1.1.3: data_quality pré-IA, recomendações estruturadas, sanitização narrativa, Meta-only.
