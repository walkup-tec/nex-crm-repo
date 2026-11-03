# NEX Intelligence v1.3.0 — Contratos (Fase 0)

**Status:** normativo para implementação  
**claim_ir_version:** `1.0.0`  
**protocol_version / engine_version:** `1.3.0`  
**data_contract_version:** `1.2.0` (Meta export / ChatGPT compat)  
**analysis_format:** `nex_intelligence_analysis_v1_3_0`

## 0.1 Schema Claim IR

Envelope (`strict` — campos desconhecidos rejeitados):

| Campo | Tipo | Notas |
|---|---|---|
| claim_id | string | obrigatório |
| operation | enum | ver operações |
| entity_level | account\|campaign\|adset\|ad | |
| entity_id | string\|null | null só em account |
| args | object | schema por operation |
| metric_refs | string[] | ids de trace / registry |
| comparison_ref | string\|null | obrigatório para E2 |
| hypothesis_ref | string\|null | |
| action_ref | string\|null | |
| requested_evidence_level | E1\|E2\|E3? | sugestão IA — **não prova** |

### Operações e args

**METRIC_VALUE** — `{ metric: string, period_key?: string }`  
**PERIOD_COMPARISON** — `{ metric, baseline_period, current_period, operator: delta_pct\|delta_abs }` + comparison_ref  
**ENTITY_COMPARISON** — `{ metric, other_entity_id, other_entity_level, operator }` + comparison_ref  
**QUALITATIVE_CLASSIFICATION** — `{ metric, label, criterion }` + comparison_ref  
**CAUSAL_HYPOTHESIS** — `{ premise, related_metric_refs, relation }`  
**MONITOR** — `{ metrics: string[], validation_criterion: { type: PERIODIC_REVIEW, metrics, comparison } }` — proibido ação estratégica  
**STRATEGIC_TEST** — `{ action_kind, action, hypothesis, validation_criterion, reversal_condition? }`

Código de rejeição: `AI_SCHEMA_INVALID` / `UNSUPPORTED_OPERATION`.

## 0.2 Matriz operação × evidência mínima

| Operação | Mínimo | Extra |
|---|---|---|
| METRIC_VALUE | E1 | trace/métrica/entidade/período PASS ou WARNING |
| PERIOD_COMPARISON | E2 | comparison_ref + compatibilidade |
| ENTITY_COMPARISON | E2 | comparison_ref + comparabilidade |
| QUALITATIVE_CLASSIFICATION | E2 | critério + comparison_ref |
| CAUSAL_HYPOTHESIS | E3 | E2 pertinente + relação (≠ causalidade comprovada) |
| MONITOR | E1 | sem intervenção/estratégia/comparação |
| STRATEGIC_TEST | E3 | E1/E2 + objetivo + ação + critério + reversão |

Backend recalcula o nível efetivo.

## 0.3 Máquina de estados (4 eixos)

### execution_status
`queued` → `running` → `succeeded` \| `failed`  
Retry apenas se erro `retryable=true`. Terminal: succeeded, failed.

### analytical_status (terminais)
- `COMPLETED` — publicação consistente, sem perda relevante verificável  
- `PARTIAL_VALIDATED` — válido com limitações/perdas  
- `FALLBACK_DETERMINISTIC` — sem conclusões IA aproveitáveis  
- `INSUFFICIENT_EVIDENCE` — nenhuma conclusão mínima  
- `FAILED` — falha técnica impeditiva  

### data_quality_status
`PASS` \| `WARNING` \| `FAIL` \| `NOT_VERIFIABLE` (por relatório global; métricas individuais independentes).

### publication_status
`not_ready` → `pending_persist` → `published` \| `failed_persist`  
ChatGPT só lê quando `published`.

### Transições ilegais
- `FAILED` ↛ `COMPLETED`  
- `failed_persist` ↛ `published`  
- publicar com `analytical_status=FAILED` proibido  
- falha técnica nunca vira sucesso silencioso  

## 0.4 Contrato de publicação

Unidade atômica `(execution_id, publication_version)`:
- versões protocol/engine/claim_ir  
- snapshot Meta + refs  
- metric registry  
- claims originais + IR normalizados  
- validações + recovery audit  
- aprovados/rejeitados  
- relatório renderizado  
- quatro status  

Falha transacional → `publication_status=failed_persist`; endpoint não expõe como publicado.

## 0.5 Migração

- Campos ChatGPT **aditivos**; tool/path/auth intactos  
- Histórico v1.1.x / v1.2.0: RO sem reprocessar  
- Migration `0051_meta_ai_v130_publication.sql`: colunas aditivas `execution_status`, `analytical_status`, `publication_status`, `publication_version`, `claim_ir_version`  
- Rollback: dropar colunas aditivas  

## 0.6 Matriz de testes de aceite (invariantes)

1. Claim publicado ⇒ trace válido  
2. E2 ⇒ comparison_ref válido  
3. E3 ⇒ justificativa + evidência  
4. Nenhum texto livre IA no relatório  
5. Recovery não sobe evidência sem prova  
6. Resumo não introduz claim novo  
7. Sem reuse indevido entidade/período  
8. Sem publish antes de persistência ok  
9. Falha parcial ≠ invalidar métricas independentes  
10. Métrica inválida ≠ PASS  

+ regressões v1.2.0 + adversariais mapeadas a IR.

---

## Resultado da suíte (implementação)

`npm test` → **19/19 ok** (inclui `v130-invariants.test.ts`).

### Arquivos principais criados/alterados

- `claim-ir/schema.ts`, `validate.ts`, `normalize-from-ai.ts`, `process.ts`
- `metrics/registry.ts`
- `recovery/transform.ts`
- `report/renderers.ts`
- `pipeline/state-machine.ts`, `context.ts` (A→J), `persistence-contract.ts`
- `errors.ts` (§15), `versions.ts` (1.3.0)
- `integrations/chatgpt/payload.ts` (só relatório se `published`; campos aditivos)
- `drizzle/migrations/0051_meta_ai_v130_publication.sql`
- `CONTRACT_V130.md`

### Compatibilidade ChatGPT

- Tool `get_meta_analysis_execution` e path `/api/integrations/chatgpt/analyses/:executionId` inalterados
- Histórico sem `publication_status` continua legível
- `data_contract_version` = `1.2.0`

### Pendências / riscos

- Migration `0051` precisa ser aplicada no Supabase (SQL Editor) antes do deploy que gravar as novas colunas
- Pipeline legado `processMetaAiRecommendations` (observations textuais) ainda coexiste; o caminho Claim IR é `processClaimIRPipeline` — orquestração full A→J no `run-meta-analysis` pode passar a preferir IR em follow-up sem quebrar regressões
- Sem commit/push/deploy nesta entrega
