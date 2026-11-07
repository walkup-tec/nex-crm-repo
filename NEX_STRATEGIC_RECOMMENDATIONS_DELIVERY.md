# NEX Intelligence — Entrega: evolução das recomendações estratégicas

**Estado Git:** alterações locais **sem commit/push** (conforme solicitado).

## 1. Causa-raiz

O builder `buildStrategicTestCandidates` gerava **um `STRATEGIC_TEST` por par** de comparison (`nx-cmp-…`), com:

- título genérico de redistribuição;
- hipótese fixa (“diferença observável… alocação ineficiente”);
- **sem** tabela de métricas nem valores do export;
- **sem** consolidação por assinatura estratégica.

Por isso a execução `d602faab-…` produziu três tarefas quase idênticas e sem diagnóstico quantitativo.

## 2. Arquivos alterados

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/nex-intelligence/goals/strategic-recommendation.ts` | Pacote consolidado + diagnóstico quantitativo + claims E3 |
| `src/lib/nex-intelligence/goals/strategic-candidates.ts` | Reexport compatível |
| `src/lib/nex-intelligence/goals/strategic-recommendation.test.ts` | Testes do pacote |
| `src/lib/nex-intelligence/validation/orchestrate.ts` | Injeta pacote (limit 2), remove `goal-candidate-*` legados |
| `src/lib/nex-intelligence/ai-output/types.ts` | `strategicRecommendations` no resultado |
| `src/lib/nex-intelligence/pipeline/persistence-contract.ts` | Campo aditivo `strategic_recommendations` |
| `src/lib/nex-intelligence/persistence/build-analytical-output.ts` | Persiste recomendações estruturadas |
| `src/lib/nex-intelligence/integrations/chatgpt/payload.ts` | Expõe `strategic_recommendations` ao plugin |
| `src/lib/nex-intelligence/dashboard/types.ts` | `SuggestedTaskDetail` |
| `src/lib/nex-intelligence/dashboard/map-execution-to-dashboard.ts` | Liga claim ↔ detalhe estratégico |
| `src/components/nex/intelligence/OptimizationTaskList.tsx` | Expansão: diagnóstico, tabela, plano, riscos, validação |
| `src/components/nex/intelligence/NexIntelligenceWorkspace.tsx` | `detail: null` em tarefa manual |
| `src/server/intelligence-ops.server.ts` | `detail: null` em row→task |
| `src/lib/nex-intelligence/goals/index.ts` | Exports |
| `scripts/run-unit-tests.mjs` | Registra novo teste |

## 3. Contratos

- **Claim IR `STRATEGIC_TEST`** permanece a autoridade E3 (`comparison_ref` + `metric_refs` escalares).
- **`StrategicRecommendation`** (backend) carrega diagnóstico, métricas, racional, plano, validação e confiança.
- Persistência aditiva: `output_json.strategic_recommendations`.
- UI: `SuggestedTask.detail` para expansão sem redesenhar as três telas.

## 4. Testes

```bash
npx tsx src/lib/nex-intelligence/goals/strategic-recommendation.test.ts
npx tsx src/lib/nex-intelligence/goals/goals-comparison-regression.test.ts
npx tsx src/lib/nex-intelligence/goals/goals-e2e.homologation.test.ts
npx tsx src/lib/nex-intelligence/pipeline/v130-invariants.test.ts
npx tsx src/lib/nex-intelligence/pipeline/v130-publication-adversarial.test.ts
```

Resultado: **PASS** nos comandos acima (estratégico 7/7; regressão goals; e2e Level A; v130).

## 5. Demonstração (fixture)

Título típico:

> Avaliar redistribuição de investimento entre anúncios com custo por resultado distintos

Inclui: problema com valores CPR/spend/results por entidade; mecanismo hipotético; passos operacionais no nível conjunto/campanha; pré-requisitos de orçamento; critérios de sucesso + guardrails; confiança E3.

## 6. Limitações

- Ainda não lê Advantage Campaign Budget via Graph API (pré-requisito textual).
- Consolidação cobre redistribuição de orçamento; outras `action_kind` da IA continuam no fluxo legado.
- Homologação real da execução `d602faab` **não** foi reprocessada automaticamente.
- Score de prioridade é heurístico documentado, não inferência estatística.

## 7. Matriz de aceite

| Critério | Status |
|----------|--------|
| Diagnóstico quantitativo verificável | PASS |
| Justificativa com mecanismo | PASS |
| Plano executável (nível Meta) | PASS (com pré-requisitos) |
| Critérios de validação mensuráveis | PASS |
| Objetivos influenciam análise | PASS |
| Consolidação de equivalentes | PASS |
| Métricas inválidas não sustentam ação | PASS (IR) |
| Investigação ≠ otimização (estrutura) | PASS parcial (categoria no detail) |
| MONITOR ≠ tarefa operacional | PASS |
| UI detalhes sem redesenho total | PASS |
| Plugin recebe estrutura | PASS (`strategic_recommendations`) |
| Testes automatizados | PASS (subset executado) |
| Contrato E1/E2/E3 preservado | PASS |
| Commit/push | **NÃO FEITO** |

## 8. Próximo passo sugerido

Após seu OK: commit/push e **uma** homologação real com os mesmos objetivos da execução de referência.
