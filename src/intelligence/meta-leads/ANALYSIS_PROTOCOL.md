# NEX Intelligence — Protocolo de Análise Meta Ads v1.1.6

Protocolo analítico Meta-only (linha 1.1) com motor de integridade **1.1.6**.

## Escopo

Fonte exclusiva: **Meta Marketing API** (`data_contract_version` 1.0.0).

## Recuperação estrutural (1.1.6)

- Máximo de **duas** chamadas à IA por execução (geração + uma regeneração).
- Falha de schema em uma seção **não** descarta seções irmãs válidas.
- Erros de schema registram o **caminho do campo** (`recommendations[0].action_kind`).
- Estados analíticos: `COMPLETED` | `PARTIAL_VALIDATED` | `FALLBACK_DETERMINISTIC` | `FAILED`.
- Sem conclusões aprovadas → relatório técnico determinístico (sem recomendações inventadas).
- Nunca publica Markdown bruto da IA.

## Vínculo entidade ↔ rastreabilidade

Cada observação/recomendação com `entity_id` deve:

- citar no texto o nome correspondente a esse ID;
- referenciar `trace_ids` cujo `entity_id`/`entity_level` sejam os mesmos;
- usar período idêntico ao export da execução.

O NEX rejeita conclusões cujo trace aponte para outra campanha (ex.: texto WhatsApp + ID Conv. Site).

## Recálculo determinístico

CTR/CPC/CPM/CPR são recalculados dos insights Meta da entidade. Inputs/result divergentes ou `PASS` inconsistente da IA são rejeitados.

## Proteções anteriores

Preserva 1.1.1–1.1.5: `data_quality`, recomendações estruturadas, sanitização narrativa, dependências matemáticas, agregação ponderada de CTR, binding entidade↔trace.
