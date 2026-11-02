# NEX Intelligence — Protocolo de Análise Meta Ads v1.1.7

Protocolo analítico Meta-only (linha 1.1) com motor de integridade **1.1.7** e evidências objetivas **E0–E3**.

## Escopo

Fonte exclusiva: **Meta Marketing API** (`data_contract_version` 1.0.0).

## Evidências objetivas (1.1.7)

| Nível | Permite | Não permite |
|-------|---------|-------------|
| E0 | — | Qualquer publicação |
| E1 | Fatos numéricos; `monitor` | Classificar desempenho; intervenções |
| E2 | Comparações compatíveis | Causalidade; intervenção |
| E3 | Testes/alterações justificadas | Prometer melhoria sem prova |

- CTR isolado **não** autoriza otimização de criativo nem escala de orçamento.
- Labels como bom/ruim/elevado/aceitável/eficiente sem comparação válida → rejeitados.
- Intervenções exigem hipótese, critério de validação e comparação compatível.

## Recuperação estrutural (1.1.6)

Máximo de duas chamadas à IA; seções validadas independentemente; fallback determinístico; nunca Markdown bruto.

## Vínculo entidade ↔ rastreabilidade (1.1.5)

`entity_id` ↔ nome ↔ `trace_ids`; período do export; recálculo Meta prevalece sobre PASS da IA.

## Proteções anteriores

Preserva 1.1.1–1.1.6.
