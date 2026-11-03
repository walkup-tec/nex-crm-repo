# NEX Intelligence — IA Analytic (Meta)

**Módulo:** `src/lib/nex-intelligence/`  
**Lab:** Meta AI / NEX Intelligence  
**Plugin ChatGPT:** NEX Intelligence — Meta Ads Analysis (`get_meta_analysis_execution`)  
**Versão-alvo do motor:** `1.3.0`  
**Última atualização:** 2026-11-03  

Este arquivo é a **memória normativa do módulo** para agentes.  
Antes de alterar o motor analítico, leia este documento.  
**Não repetir erros já registrados.** Preferir correção estrutural à correção isolada de regex/frase.

Contratos detalhados também em:

- `src/lib/nex-intelligence/CONTRACT_V130.md`
- `src/lib/nex-intelligence/CONTRACT_V120_AUDIT.md`
- `src/lib/nex-intelligence/REPORT_PUBLICATION_AUDIT_V130.md`

---

## 1. Objetivo do módulo

Produzir análises técnicas de campanhas Meta (Marketing API) com:

1. Evidências verificáveis (E0–E3).
2. Claim IR estruturado (não texto livre da IA).
3. Publicação só após gate final.
4. Plugin ChatGPT somente leitura, sem aprovar claims no backend.

**Fonte única analítica:** Meta Marketing API.  
Proibido usar CRM, vendas, receita, chatbot, benchmarks inventados ou métricas inventadas pela IA como fato.

---

## 2. Pipeline obrigatório (A→J)

| Etapa | Nome | Papel |
|---|---|---|
| A | MetaCollection | Coleta Meta |
| B | NormalizeIntegrity | Qualidade / integridade |
| C | MetricRegistryTraces | Catálogo + traces backend |
| D | AIProposals | Propostas estruturadas (não fatos) |
| E | SemanticClassifyValidate | Validação Claim IR |
| F | DeterministicRecovery | CMS-E1 / transform |
| G | Revalidate | Revalidar recuperados |
| H | BuildReport | `buildValidatedReport` |
| I | PersistTransactional | `pending_persist` → `published` |
| J | ChatGPT_Readonly | Payload RO |

A ordem lógica é obrigatória. O plugin ChatGPT **não** participa da aprovação.

---

## 3. Histórico de versões e o que foi feito

### v1.1.x — bases e correções incrementais

| Tema | Entrega |
|---|---|
| Métricas determinísticas | Formulas + data quality |
| Gate pós-IA | Validação de recomendações |
| Sanitização narrativa | Integridade de conclusões |
| Traceability | Dependências de métricas / CTR ponderado |
| Binding de entidade | Claim ↔ traces Meta |
| Schema parcial | Recovery + fallback determinístico |
| Evidências E0–E3 | Níveis objetivos |
| CMS-E1 | Recuperação MONITOR para métricas válidas |

### v1.2.0 — backend dono dos traces

- Catálogo completo **antes** da OpenAI.
- IA recebe `available_traces`; **não** cria/valida traces.
- Rebind determinístico entity+metric+período.
- CMS antes da 2ª chamada OpenAI; máx. 2 chamadas.
- Aceite: quatro campanhas × CTR (`four-campaign-ctr-acceptance.test.ts`).
- Bloqueio de resumo qualitativo sem E2.

### v1.3.0 — Claim IR + fronteira de publicação

| Entrega | Local |
|---|---|
| Claim IR (schema/ops/validate/process) | `claim-ir/` |
| Fronteira única de publicação | `publication/build-validated-report.ts` |
| Etapa 1 só de integridade | `publication/stage1-integrity.ts` |
| Gate final | `publication/final-gate.ts` |
| Renderização determinística | `report/renderers.ts` |
| Compositores legados desativados | `compose-published-markdown.ts` / fallback → `legacy_publication_path_disabled` |
| Persistência com eixos de status | `persistence/`, `meta-ai.server.ts` |
| Migration aditiva | `drizzle/migrations/0051_meta_ai_v130_publication.sql` |
| Testes adversariais (15) | `pipeline/v130-publication-adversarial.test.ts` |
| MONITOR E1 sem `evidence[]` textual | `validation/recommendations.ts` + CMS-E1 + `v130-monitor-e1-recovery.test.ts` |

**Commits-chave (ordem recente):**

- `8506982` — publication boundary + final gate  
- `1b36170` — monitor juízo/estratégia (b05a266d)  
- `7e5499e` — Claim IR pipeline v1.3.0  
- `7e5ad30` — block qualitative executive without E2  
- `bdc4d7d` / `e0d2ec1` — v1.2.0 traces backend  

---

## 4. Execuções reais que falharam (não reabrir o mesmo buraco)

| UUID | Sintoma | Causa-raiz comprovada | Correção estrutural |
|---|---|---|---|
| `6ea98229-…` | Etapa 1 truncada (`Geral - Nex Ads [Eng.`) | `stage1_markdown` da IA publicado via sanitizer | Etapa 1 **só** `stage1-integrity` |
| `6ea98229-…` | “abaixo da média” APPROVED E1 | juízo E2 + `claim.text` publicado | Claim IR + renderer; sem texto livre |
| `6ea98229-…` | `analytical_status=COMPLETED` indevido | status antes do gate | status **após** `buildValidatedReport` + gate |
| `b05a266d-…` | MONITOR com juízo/estratégia | classificação frouxa | rejeitar MONITOR com juízo/estratégia |
| `3272c70a-…` | MONITOR E1 rejeitado `insufficient_evidence` | exigir `evidence[]` textual da IA | evidência = traces + catálogo backend |
| `3272c70a-…` | `cms_e1_already_sufficient` sem aprovação | recovery não devolvia MONITOR canônico | CMS-E1 sempre materializa MONITOR quando há métricas válidas |
| `3272c70a-…` | “confiança média” na Etapa 1 | descrição livre de quality | só códigos/estado estruturado |

Outras falhas históricas (v1.1/v1.2) já cobertas por regressões: paginação/cobertura, média simples de taxas, trace cruzado, schema total fail, spend qualitativo sem E2, etc.

---

## 5. Regras anti-regressão (OBRIGATÓRIAS para agentes)

### 5.1 Nunca fazer

1. **Publicar texto livre da IA** (`stage1_markdown`, `observations[].text`, `executive_points[].text`, `recommended_action`, `evidence[]`, `hypothesis` narrativos) no relatório final.
2. **Corrigir só com regex/frase** quando a falha for de fronteira, proveniência ou status.
3. **Usar `claim_kind` / `requested_evidence_level` da IA como autoridade.**
4. **Marcar `COMPLETED` ou `published` antes do gate + persistência atômica.**
5. **Exigir que a IA repita números em `evidence[]`** quando `trace_ids` resolvem no catálogo.
6. **Transformar intervenção estratégica em MONITOR aprovado sem registrar transformação** (descartar E3 e criar MONITOR novo, auditado).
7. **Inventar evidência** na recovery.
8. **Alterar** tool/endpoint/auth do plugin ChatGPT.
9. **Pedir execução real Meta/OpenAI** enquanto a suíte local relevante falhar, salvo autorização explícita.
10. **Commit/push/deploy** sem autorização explícita do usuário.
11. **Mascarar falha** alterando asserts que contradizem o contrato E1/E2/E3.
12. **Reativar** `composePublishedMarkdown` / fallback legado como caminho de produção.

### 5.2 Sempre fazer

1. Publicar **somente** via `buildValidatedReport` → `runFinalPublicationGate`.
2. Etapa 1: **apenas** objetos de integridade (`MetaDataQualityReport` + período).
3. Etapas 2/4: **somente** ValidatedClaim IR + `report/renderers.ts`.
4. Etapa 3: recomendações APPROVED; MONITOR E1 **sem** mudança de público/orçamento/criativo/posicionamento.
5. MONITOR E1: provar com **traces/catálogo**; `evidence[]` vazio + traces válidos = válido.
6. CMS-E1: se métricas válidas existem, **materializar** MONITOR canônico (não só marcar `already_sufficient`).
7. Status analítico derivado **depois** do artefato gated.
8. Persistência: `pending_persist` → update atômico → `published`; ChatGPT só lê `published`.
9. Adicionar regressão automatizada para **cada** classe de falha nova.
10. Preferir evolução in-place em `src/lib/nex-intelligence/`.

---

## 6. Contrato de evidências (resumo)

| Nível | Permite | Não permite |
|---|---|---|
| E0 | Nada analítico publicável | — |
| E1 | Valor métrico, observação neutra, MONITOR | Juízo, comparação, causalidade, estratégia |
| E2 | Comparação verificável | Causalidade / estratégia |
| E3 | Teste estratégico controlado | Garantia de resultado |

“Abaixo da média”, “ineficiente”, “pode ser melhorado”, “confiança média” **não** são E1.

---

## 7. Claim IR — operações

`METRIC_VALUE` · `PERIOD_COMPARISON` · `ENTITY_COMPARISON` · `QUALITATIVE_CLASSIFICATION` · `CAUSAL_HYPOTHESIS` · `MONITOR` · `STRATEGIC_TEST`

Tipos: Proposed → Normalized → Validated → Recovered/Rejected.  
**Só ValidatedClaim** (pós-validação runtime) entra no compositor. Sem cast inseguro.

---

## 8. Estados

- `execution_status`: queued → running → succeeded | failed  
- `analytical_status`: COMPLETED | PARTIAL_VALIDATED | FALLBACK_DETERMINISTIC | INSUFFICIENT_EVIDENCE | FAILED  
- `data_quality_status`: PASS | WARNING | FAIL | NOT_VERIFIABLE  
- `publication_status`: not_ready → pending_persist → published | failed_persist  

`COMPLETED` ≠ “processo terminou”. Significa publicação consistente após validação.

---

## 9. Plugin ChatGPT (intocável sem pedido explícito)

- Tool: `get_meta_analysis_execution`  
- `GET /api/integrations/chatgpt/analyses/:executionId`  
- `Authorization: Bearer <token>`  
- Somente leitura; não aprova claims; não altera campanhas/dados.

Versões de resposta-alvo:

- `protocol_version` / `engine_version`: `1.3.0`  
- `data_contract_version`: `1.2.0`  
- `analysis_format`: `nex_intelligence_analysis_v1_3_0`

---

## 10. Testes que devem permanecer verdes

| Arquivo | Papel |
|---|---|
| `pipeline/v130-publication-adversarial.test.ts` | 15 casos de fronteira |
| `pipeline/v130-monitor-e1-recovery.test.ts` | evidence vazio; cms_e1; NOT_VERIFIABLE; fallback |
| `pipeline/v130-b05a266d-regression.test.ts` | monitor juízo/estratégia |
| `pipeline/v130-invariants.test.ts` | invariantes Claim IR |
| `pipeline/four-campaign-ctr-acceptance.test.ts` | E2E 4 campanhas CTR |
| `pipeline/v120-qualitative-spend-regression.test.ts` | juízo qualitativo / spend |
| `pipeline/run-meta-analysis.pipeline.test.ts` | CMS antes de regen |
| `nex-intelligence-historical-regression.test.ts` | parse legado |

Suite Meta: `scripts/run-unit-tests.mjs` (lista `META_TEST_FILES`).  
Não declarar sucesso só por compile. Suite local verde antes de pedir execução real.

---

## 11. Checklist rápido antes de qualquer PR/alteração neste módulo

- [ ] A falha é de **fronteira/proveniência/status**, não de “frase faltando na regex”?  
- [ ] Algum caminho ainda publica texto da IA?  
- [ ] Etapa 1 usa só integridade?  
- [ ] MONITOR E1 prova por traces, sem depender de `evidence[]`?  
- [ ] CMS-E1 materializa MONITOR quando há métricas válidas?  
- [ ] Gate final roda antes de `published`/`COMPLETED`?  
- [ ] Há regressão nova cobrindo o sintoma?  
- [ ] ChatGPT tool/endpoint/auth intactos?  
- [ ] Sem commit/push/deploy sem autorização?

---

## 12. Pendências operacionais conhecidas

- Aplicar `0051_meta_ai_v130_publication.sql` no banco **antes** do deploy que depende das colunas de publicação.
- Typecheck global do monorepo pode falhar por erros **fora** deste módulo; validar com build + suite Meta.
- Assert legado em `meta-recommendation-validation.test.ts` que exige juízo E2 com E1: **não** “consertar” o motor para passar esse assert; alinhar o teste ao contrato se/quando autorizado.
- Não solicitar nova execução real até demonstrar testes locais da classe de falha corrigida.

---

## 13. Princípio final

> O objetivo não é fazer a última execução real “passar”.  
> O objetivo é impedir que qualquer execução futura publique conclusão não comprovada pelo backend.
