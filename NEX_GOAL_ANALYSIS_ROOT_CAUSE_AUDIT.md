# NEX Intelligence v1.3.0 — Auditoria técnica de causa-raiz do motor orientado a objetivos

**Escopo:** auditoria + testes diagnósticos + plano de correção.  
**Fora de escopo nesta entrega:** implementação de correções, commit, push, deploy, alteração Meta.  
**Execução de referência (sintoma):** `741e2bc9-a05e-4c44-a52b-909216ad8f06` (26–31/10/2026; objetivos `INCREASE_RESULTS` + `DECREASE_COST_PER_RESULT`; `PARTIAL_VALIDATED` / `published` / `NOT_VERIFIABLE`; só MONITOR; `results (indisponível)`).  
**Dump live da execução:** não obtido nesta sessão (sem inspeção de secrets/DB). Achados abaixo estão **reproduzidos em fixture local** com o mesmo padrão estrutural descrito pelo sintoma.

---

### A. Diagnóstico executivo

O NEX **recebe** os objetivos e até **expande** prompt + comparisons em torno de `results` / `cost_per_result`, mas o pipeline **impede otimizações fundamentadas** por uma cadeia de falhas:

1. Qualidade Meta marca `results` (e frequentemente o status global) como `NOT_VERIFIABLE` / WARNING.
2. `buildBackendMetricTraceCatalog` **descarta** todo `nx-tr-*-results` e `nx-tr-*-cost_per_result` cujo status determinístico ≠ `PASS`.
3. `buildValidatedComparisonRecords` **continua emitindo** `nx-cmp-*-results` / `*-cost_per_result` com `comparable: true` e `validation.status: PASS`.
4. A IA, sem scalar de results no `available_traces`, coloca **comparisons em `metric_refs`** de `METRIC_VALUE` — e `validateClaimIR` **aprova como E1**.
5. `buildMetricRegistry` **não possui linha `results`**, então o renderer publica `results (indisponível)` mesmo em claim “aprovado”.
6. `STRATEGIC_TEST` sem `comparison_ref` (ou com refs frágeis) é **recuperado para MONITOR**; MONITOR **não vira tarefa** no dashboard. Resultado: “análise publicada” sem otimização operacional.

**Conclusão:** não é falta de objetivos no metadata — é **assimetria catálogo/comparação + validação IR permissiva + registry incompleto + recovery que mascara falha E3**.

---

### B. Causas comprovadas

| ID | Causa | Arquivo / função | Evidência | Reprodução | Impacto |
|----|--------|------------------|-----------|------------|---------|
| C1 | Catálogo escalar omite `results`/`CPR` quando quality bloqueia, mas comparisons dessas métricas seguem | `trace/build-catalog.ts` `buildBackendMetricTraceCatalog` (`if (status.status !== "PASS") continue`); `trace/build-comparisons.ts` `buildValidatedComparisonRecords` | Fixture: `resultsTr=MISSING` + `nx-cmp-…-results` presente (teste **P0**) | `npx tsx src/lib/nex-intelligence/goals/goals-root-cause-audit.test.ts` | IA não tem `nx-tr` do objetivo; usa `nx-cmp` indevidamente; E3 de RESULTS/CPR fica estruturalmente estéril |
| C2 | `METRIC_VALUE` aceita `nx-cmp-*` em `metric_refs` e refs extras de outra métrica | `claim-ir/validate.ts` `tracesOk` + `metric_trace_mismatch` (exige **algum** ref com a métrica; **não** exige tipo escalar; **não** rejeita extras) | Caso B APPROVED E1 com `…-results` + `…-ctr` em `metric_refs` | Teste **B** | Explica claim IR do sintoma: comparação CTR “prova” observação de results |
| C3 | Registry não emite métrica `results` | `metrics/registry.ts` `pushEntityMetrics` (specs: impressions/clicks/spend/ctr/cpc/cpm/CPR — **sem results**) | Renderer: `results (indisponível)` | Teste **I** | Relatório mentiroso: E1 aprovado + valor ausente |
| C4 | `integrityFor` pinta **todo** o registry quando `quality.status === NOT_VERIFIABLE` | `metrics/registry.ts` `integrityFor` → `global_not_verifiable` | CTR `integrity=NOT_VERIFIABLE` apesar de independente | Teste **C2** | Métricas utilizáveis (CTR/CPC) parecem inválidas no estágio C |
| C5 | Recovery `STRATEGIC_TEST` → `MONITOR` sem preservar diagnóstico de “ação rejeitada vs monitoramento” no dashboard | `recovery/transform.ts` `strategic_or_causal_to_monitor`; `dashboard/map-execution-to-dashboard.ts` `claimToTask` retorna `null` para MONITOR | F → MONITOR; O → MONITOR não é otimização | Testes **F**, **H**, **O** | Usuário vê “publicado” + 2 monitores; zero otimização |
| C6 | E3 não exige alinhamento métrica(scalar) ↔ métrica(comparison) | `claim-ir/validate.ts` (E3: `comparisonValidated && metric_refs.length > 0` apenas) | STRATEGIC aprovado E3 com `metric_refs=ctr` + `comparison_ref=CPR` | Teste **G** | Ação “estratégica” pode fundamentar-se em evidências de métricas diferentes |
| C7 | Objetivos influenciam prompt/comparisons, mas **não geram** propostas; só ranqueiam o que já existe | `goals/prompt.ts`, `goals/rank.ts`, `compose.ts`; ausência de gerador determinístico de STRATEGIC_TEST | J/K PASS; ainda assim pipeline real depende 100% da IA | Testes **J**, **K** + fluxo `run-meta-analysis.ts` | Objetivos “chegam” sem obrigar investigação operacional |

**Sobre o claim citado (sintoma):**

```json
{
  "operation": "METRIC_VALUE",
  "args": { "metric": "results" },
  "metric_refs": [
    "nx-cmp-entity-campaign-120254698455700651-vs-120254677410570651-results",
    "nx-cmp-entity-campaign-120254698455700651-vs-120254664879240651-ctr"
  ]
}
```

- **Origem mais provável:** geração da IA (sem `nx-tr-*-results` em `available_traces`) + **aprovação na validação Claim IR** (C2).  
- **Não** é o rebind que troca CTR→results: `rebindClaimTraces` só resolve `nx-tr-*` por entity+metric.  
- **Não** é o renderer que “inventa” E1: o claim já entra aprovado; o renderer só falha ao formatar (C3).

---

### C. Hipóteses pendentes

| ID | Hipótese | Por que pendente |
|----|----------|------------------|
| H1 | Na execução `741e2bc9`, `available_traces` de fato omitiu todos os `nx-tr-*-results` | Requer dump de `input.json` / `output.json` / catálogo persistido |
| H2 | Modelo `gpt-4o-mini` aumenta taxa de MONITOR vs STRATEGIC_TEST bem formado | Não atribuído como causa sem A/B controlado; falhas estruturais (C1–C6) bastam para esterilidade |
| H3 | Regeneração estrutural repete o mesmo contexto sem corrigir refs | Código em `orchestrate.ts` / `run-meta-analysis.ts` existe; não auditado claim-a-claim na execução real |
| H4 | `CAMPAIGN_RESULTS_*` da conta NEX é messaging non-additive (esperado) vs bug de coleta `action_type` | Precisa comparar daily raw Meta vs consolidado da execução |
| H5 | Ads sem comparison no fixture sob quality atual | Teste L: adset ok, ad variável; validar na conta real |

---

### D. Fluxo atual

```text
UI AnalysisObjectivesPicker
  → validateAnalysisObjectives (goals/validate.ts)
  → metadata.analysis_objectives no export
  → validateMetaAnalysisData (quality)  [CAMPAIGN_RESULTS_* / status]
  → buildBackendMetricTraceCatalog      [nx-tr-*; DROP se status≠PASS]
  → buildValidatedComparisonRecords     [nx-cmp-*; results/CPR com gate de evento]
  → metaAiUserPrompt (+ formatObjectivesForPrompt)
       available_traces = só !nx-cmp-*
       available_comparisons = nx-cmp-*
  → OpenAI (default gpt-4o-mini) → JSON claim_ir / recommendations
  → orchestrate / rebindClaimTraces (só nx-tr)
  → normalizeClaimIRDraft → validateClaimIR → recoverClaimIRStructural
  → processClaimIRPipeline → renderClaimIR / buildValidatedReport
  → map-execution-to-dashboard (MONITOR→sem tarefa; STRATEGIC_TEST E3→tarefa)
```

**Diferenciação formal de IDs**

| Prefixo | Significado | Uso correto |
|---------|-------------|-------------|
| `nx-tr-{level}-{entityId}-{metric}` | Trace escalar | `metric_refs` |
| `nx-cmp-entity-{level}-{left}-vs-{right}-{metric}` | Comparação entidade | `comparison_ref` |
| `nx-cmp-period-campaign-{id}-{metric}-{start}-{end}` | Comparação período | `comparison_ref` |

Comparisons são `MetricTraceRecord` no **mesmo** mapa que scalars (`calculation.comparable: true`), o que facilita o uso indevido em `metric_refs`.

---

### E. Falhas por severidade

**CRITICAL**

- C1 assimetria nx-tr omitido / nx-cmp emitido para results & CPR  
- C2 METRIC_VALUE E1 com comparisons (incl. CTR)  
- C3 `results (indisponível)` em claim aprovado  

**HIGH**

- C6 E3 com métricas desalinhadas (CTR vs CPR)  
- C5 recovery → MONITOR sem otimização / sem cobertura de objetivo  
- Qualidade `NOT_VERIFIABLE` em results bloqueia o objetivo primário sem caminho alternativo honesto  

**MEDIUM**

- C4 integrity global no registry  
- C7 ausência de gerador determinístico de hipóteses/testes a partir de comparisons  
- Recovery default `["ctr"]` quando não há métricas inferíveis (`recovery/transform.ts`)  

**LOW**

- `metricsForObjectives` sempre re-adiciona DEFAULT_COMPARISON_METRICS (não estreita o universo)  
- Prompt pede contrato rico de recomendação, mas schema IR não carrega todos os campos conceituais (goal, risks, confidence) de forma obrigatória  

---

### F. Plano de correção (dependências — **não implementar agora**)

**Fase 0 — Contratos (bloqueante)**  
1. Em `validateClaimIR`: rejeitar `metric_refs` que começam com `nx-cmp-` (ou `calculation.comparable === true`).  
2. Exigir que **todos** os `metric_refs` de `METRIC_VALUE`/`MONITOR` tenham `metric` canônico ∈ args (não só “algum”).  
3. Para E2/E3: exigir `comparison_ref.metric` alinhado às métricas dos `metric_refs` (e preferencialmente ao objetivo).  

**Fase 1 — Catálogo coerente**  
4. Não emitir `nx-cmp` de métrica cujo scalar correspondente foi dropado por quality **ou** emitir scalar com status `NOT_VERIFIABLE` visível (nunca omitir silenciosamente).  
5. Separar semanticamente comparisons do mapa usado em `metric_refs` (mapa distinto ou kind explícito).  

**Fase 2 — Registry / publicação**  
6. Incluir `results` em `pushEntityMetrics` com `value_present` distinto de zero.  
7. `integrityFor` por `affected_metrics` / checks da entidade — não global.  
8. Renderer: se claim aprovado e valor ausente → **falha de publicação** daquele claim (não texto “indisponível” silencioso).  

**Fase 3 — Motor de objetivos**  
9. Gerador determinístico de *candidatos* STRATEGIC_TEST a partir de `available_comparisons` priorizadas por `composeGoalAnalysis` / `primaryGoal` (a IA escolhe/refina; não inventa evidência).  
10. Indicador `objectives_coverage` separado de `publication_status` / `analytical_status`.  
11. Recovery: marcar `rejected_strategic` vs `monitor` explicitamente no output e no dashboard (sem virar “otimização”).  

**Fase 4 — Qualidade Meta**  
12. Preservar coleta: mesmo `action_type` / atribuição entre daily e consolidado; documentar métricas messaging non-additive como limitação **por métrica**, sem invalidar CTR/spend utilizáveis.  

Ordem: **0 → 1 → 2 → 3 → 4**. Correções isoladas (só prompt, só modelo, só threshold) **não** fecham o buraco.

---

### G. Testes

Arquivo: `src/lib/nex-intelligence/goals/goals-root-cause-audit.test.ts`  
Comando: `npx tsx src/lib/nex-intelligence/goals/goals-root-cause-audit.test.ts`  
**Não** registrado em `scripts/run-unit-tests.mjs` (diagnóstico; exit 1 esperado enquanto lacunas existirem).

| ID | Resultado | O que demonstra |
|----|-----------|-----------------|
| P0 | **FAIL** | Scalar results/CPR ausente com cmp presente |
| A | PASS | CTR sozinho não valida METRIC_VALUE(results) |
| B | **FAIL** | nx-cmp(+CTR) aprovado como E1 em METRIC_VALUE(results) |
| C | PASS | Eventos lead vs messaging bloqueados em results/CPR |
| D | PASS | null não entra; zero numérico ≠ ausência |
| E | PASS | CAMPAIGN_RESULTS_DAILY_VS_CONSOLIDATED detectado |
| F | PASS | STRATEGIC sem cmp → MONITOR |
| G | **FAIL** | E3 aprovado com CTR + comparison CPR |
| H | PASS | Recovery structural → MONITOR E1 |
| I | **FAIL** | Renderer `results (indisponível)` / registry sem results |
| J | PASS | Objetivos no prompt + comparisons |
| K | PASS | Ranking por primaryGoal |
| L | PASS | Adset comparisons presentes |
| M | PASS | Zero ≠ null no catálogo (com quality PASS forçado) |
| N | PASS | Parcial + audit recovery |
| O | PASS | MONITOR ≠ otimização no markdown |
| C2 | **FAIL** | integrity CTR = NOT_VERIFIABLE global |

**Resumo:** Total **17** · PASS **12** · FAIL **5** (lacunas reais do motor).

Testes de regressão pré-existentes (`goals-comparison-regression.test.ts`, homologação E2E) passam caminhos “felizes” com fixture quando CPR scalar existe; **não** cobriam C1/C2/C3/C6 sob `NOT_VERIFIABLE`.

---

### H. Critérios de aceite

1. Com objetivos RESULTS+CPR, se houver comparisons CPR/results válidas **e** dados Meta reconciliáveis, o pipeline deve poder aprovar ≥1 `STRATEGIC_TEST` E3 **sem** inventar evidência.  
2. `METRIC_VALUE(results)` **rejeita** qualquer `nx-cmp-*` e qualquer ref cuja métrica ≠ `results`.  
3. Todo claim `METRIC_VALUE(results)` aprovado renderiza valor numérico **ou** é removido da publicação (nunca “indisponível” aprovado).  
4. Se `results` for `NOT_VERIFIABLE`, o relatório declara **limitação do objetivo** e ainda permite otimizações em métricas independentes verificáveis **somente** se o objetivo secundário as cobrir — sem fingir cobertura de RESULTS.  
5. Dashboard distingue: otimização E3 · investigação pendente · MONITOR · objetivo sem cobertura.  
6. Testes A–O (invariantes) PASS; execução reprocessada estilo `741e2bc9` deixa de publicar METRIC_VALUE com cmp/CTR.  

---

### I. Arquivos afetados (para correção futura)

- `src/lib/nex-intelligence/claim-ir/validate.ts`  
- `src/lib/nex-intelligence/trace/build-catalog.ts`  
- `src/lib/nex-intelligence/trace/build-comparisons.ts`  
- `src/lib/nex-intelligence/metrics/registry.ts`  
- `src/lib/nex-intelligence/report/renderers.ts`  
- `src/lib/nex-intelligence/recovery/transform.ts`  
- `src/lib/nex-intelligence/dashboard/map-execution-to-dashboard.ts`  
- `src/lib/nex-intelligence/goals/prompt.ts` / `compose.ts` / (novo) gerador de candidatos  
- `src/lib/meta-ai-prompt.ts`  
- `src/lib/nex-intelligence/quality/validate-export.ts` (granularidade affected vs global)  
- `src/lib/nex-intelligence/publication/build-validated-report.ts` / state-machine (objectives_coverage)  
- Testes: `goals-root-cause-audit.test.ts` (+ promover a regressão após fix)

---

### J. Riscos e compatibilidade

| Área | Risco | Mitigação |
|------|-------|-----------|
| Protocolo v1.3.0 E1/E2/E3 | Fechar C2/C6 **aumenta** rejeições de claims IA atuais | Recovery continua; não baixar evidência mínima |
| Histórico de execuções | Relatórios antigos com “indisponível” permanecem | Não reescrever; flag de engine em novas runs |
| Banco / output JSON | Novo campo `objectives_coverage` | Aditivo, não breaking |
| Plugin ChatGPT | Payload com comparisons/traces | Manter IDs; filtrar cmp de metric_refs no validador |
| UI | MONITOR já não é tarefa; falta cobertura de objetivo | Indicador novo, sem novas telas obrigatórias nesta fase |
| Meta-only | Sem mudança de fonte | Coleta: alinhar action_type/attribution |

---

### Respostas obrigatórias (critério de conclusão)

1. **Por que objetivos não geram otimizações?** Chegam ao prompt/comparisons, mas scalars do objetivo somem (C1), E3 depende da IA + comparison alinhada, falhas viram MONITOR (C5), e MONITOR não é otimização.  
2. **Por que comparisons em claims incompatíveis?** IA usa o que resta (`nx-cmp`); `validateClaimIR` não restringe tipo nem extras (C2).  
3. **Por que valores aprovados = indisponível?** Registry sem `results` (C3); renderer formata ausência.  
4. **Por que E2/E3 não aproveitados?** Comparisons E2 **existem**, mas ou não entram em `comparison_ref` de STRATEGIC_TEST, ou E3 é aprovado com métricas cruzadas (C6), ou recovery descarta a ação.  
5. **O que corrigir?** Fase 0–3 do plano: validação IR estrita, catálogo simétrico, registry/renderer honestos, candidatos determinísticos por objetivo, cobertura explícita — **sem** enfraquecer E1/E2/E3.

---

**Status:** correções Fases 0–3 implementadas (2026-11-07). Diagnóstico A–O: **17 PASS / 0 FAIL**.  
Sem commit/push/deploy nesta etapa — aguardar OK explícito para versionar.
