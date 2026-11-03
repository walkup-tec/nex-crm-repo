# NEX Intelligence v1.2.0 — Matriz de auditoria e testes

Execução de referência (falha estrutural pré-correção): `75ad6b61-040c-463d-a675-ba68c6d843bf`

## Matriz de contrato (após correção estrutural)

| # | Exigência | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | Catálogo completo de métricas/traces no backend **antes** da OpenAI | PASS | `trace/build-catalog.ts` + `pipeline/run-meta-analysis.ts` gera `backendTraceability` antes de `requestOpenAi` |
| 2 | IA recebe identificadores de rastreabilidade (entity+metric) | PASS | `metaAiUserPrompt(..., catalog)` injeta `available_traces` |
| 3 | IA não cria/valida traces (backend = fonte de verdade) | PASS | `replaceAiTraceabilityWithBackend` descarta `metric_traceability` da IA; protocol/prompt atualizados |
| 4 | Trace errado/ausente → rebind determinístico entity+metric+período | PASS | `trace/rebind.ts` (`rebindClaimTraces` / `rebindRecommendationTraces`) |
| 5 | Recuperar observações E1 válidas mesmo com trace IA errado | PASS | Aceite `four-campaign-ctr-acceptance.test.ts` (4/4 APPROVED) |
| 6 | Monitor neutro: CMS-E1 parcial | PASS | `orchestrate.ts` CMS antes de OpenAI#2 + `recovery/cms-e1.ts` |
| 7 | Não recuperar intervenção estratégica sem E3 | PASS | CMS-E1 só `action_kind=monitor`; E3 gates em `recommendations.ts` / evidence levels |
| 8 | Revalidar itens recuperados antes de publicar | PASS | D → CMS → D → (regen) → validateClaimList/List novamente |
| 9 | Relatório só com itens APPROVED | PASS | `composePublishedMarkdown` / fallback usam approved only |
| 10 | Testes E2E multi-campanha / traces errados | PASS | `pipeline/four-campaign-ctr-acceptance.test.ts` |

## Critério de aceite

> Quatro campanhas e quatro CTRs verificáveis devem publicar as quatro observações corretas, independentemente de erros de referência da IA.

**Resultado do teste local:** `four-campaign-ctr-acceptance.test.ts: ok`

## Demais itens v1.2.0

| Item | Status |
|------|--------|
| CMS antes de OpenAI#2 | PASS |
| Máx. 2 chamadas OpenAI | PASS (`NEX_INTELLIGENCE_MAX_AI_CALLS`) |
| Persistência com evidências + ChatGPT RO | PASS (`analytical_evidences`) |
| Format `nex_intelligence_analysis_v1_2_0` | PASS |
| Unificar dashboard `metricsOf` com catálogo | DÍVIDA (fora do escopo desta correção) |
| Conferência numérica texto↔catálogo | PASS (`validation/numeric-claims.ts`: só `%`; todo valor citado deve casar; T4) |
| Recálculo de traces `OTHER` forjados | PASS (`computeDeterministicTraceStatus`) |
| `used_by` da IA não bloqueia catálogo `nx-tr-*` | PASS |

## Matriz de testes (obrigatória)

| Suite | Cobertura |
|-------|-----------|
| `four-campaign-ctr-acceptance.test.ts` | 4 campanhas × CTR; traces wrong/empty/crossed; prompt available_traces; 1 AI call |
| `run-meta-analysis.pipeline.test.ts` | CMS antes de regen |
| `nex-intelligence-historical-regression.test.ts` | parse legado + 1.2.0 |
| `meta-cms-e1.test.ts` | CMS-E1 monitor |
| `meta-recommendation-validation.test.ts` | A–X gates |
| `meta-metric-traceability.test.ts` | recompute / binding |
| `meta-evidence-levels.test.ts` | E0–E3 |
| `protocol-v1.1.test.ts` | versões/prompt 1.2.0 |
| `chatgpt-integration.test.ts` | payload RO |

**Suite local:** `npm test` → **17/17 ok** (incl. aceite 4×CTR + A–X + T4 valor forjado).

**Política:** suite unitária verde; execução real Meta/OpenAI só com autorização explícita. Sem commit/push/deploy sem autorização.
