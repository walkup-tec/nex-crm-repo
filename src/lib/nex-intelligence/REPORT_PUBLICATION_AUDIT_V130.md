# Auditoria de publicação — NEX Intelligence v1.3.0

**Execução de referência:** `6ea98229-a59b-4f10-8811-dea584f33583`

## Causas-raiz

### Falha A — Texto truncado na Etapa 1

| Item | Evidência |
|---|---|
| Função | `sanitizeNarrativeText` → `composePublishedMarkdown` (`stage1`) |
| Origem | `working.stage1_markdown` da resposta JSON da IA (`ai-output/parse.ts`) |
| Caminho | `orchestrate.ts` ~L447–460 passa markdown IA sanitizado para Etapa 1 |
| Por que passou | Unidade narrativa truncada sem número → `requireTraces=false` → claim `descriptive` APPROVED |
| Gate | Não existia validação final de truncamento / proveniência da Etapa 1 |

**Correção:** Etapa 1 passa a ser gerada **somente** por `publication/stage1-integrity.ts` a partir de `MetaDataQualityReport` + período. Markdown IA nunca alimenta Etapa 1.

### Falha B — Comparação aprovada com E1

| Item | Evidência |
|---|---|
| Texto | `…desempenho abaixo da média das campanhas` |
| Classificação IA | `claim_kind: descriptive` |
| Backend | `PERFORMANCE_JUDGMENT_RE` / `IMPROVEMENT_WITHOUT_COMPARISON_RE` **não** cobriam “abaixo da média” |
| Publicação | `composeExecutiveFromApproved` / `renderClaimsMarkdown` publicavam `claim.text` (texto livre IA) |
| Trace | CTR próprio ≠ comparação E2 |

**Correção:** Expandir detecção comparativa; publicação só via Claim IR + renderizadores; proibir `claim.text` no relatório.

### Falha C — `analytical_status = COMPLETED`

| Item | Evidência |
|---|---|
| Definição | `resolveAnalyticalStatus` em `orchestrate.ts` após contagem de APPROVED |
| Momento | **Antes** de qualquer gate de conteúdo do Markdown |
| Problema | COMPLETED = “há itens aprovados”, não “relatório válido” |

**Correção:** Status recalculado após `buildValidatedReport` + `finalPublicationGate`; falha do gate → não COMPLETED / não PUBLISHED.

## Fontes que alimentavam o relatório (antes)

1. `stage1_markdown` IA — **inseguro** (Falha A)
2. `observations[].text` APPROVED — texto livre
3. `executive_points[].text` APPROVED — texto livre (Falha B)
4. `recommendations` campos livres (`recommended_action`, `evidence`)
5. Fallback determinístico — seguro (dados quality)
6. CMS-E1 — templates parciais

## Fronteira única (depois)

`publication/build-validated-report.ts` é a única função que produz Markdown publicável.

Pipeline: validação/IR → recovery → revalidate → **buildValidatedReport** → **finalGate** → persistência.

## Diagnóstico comprovado no fluxo ativo

### Caminho completo anterior à correção

1. `pipeline/run-meta-analysis.ts` obtinha a resposta OpenAI e chamava
   `processMetaAiRecommendations`.
2. `ai-output/parse.ts` aceitava `stage1_markdown`, `observations[].text`,
   `recommendations` narrativas e `executive_points[].text`.
3. `validation/orchestrate.ts` reatrelava traces e validava itens isolados, mas:
   - sanitizava e publicava `working.stage1_markdown`;
   - enviava `ValidatedClaim.text` a `renderClaimsMarkdown`;
   - enviava `recommended_action`, `evidence`, `hypothesis` e
     `validation_criterion` ao compositor legado;
   - calculava `analytical_status` pela contagem de itens aprovados.
4. `report/compose-published-markdown.ts` concatenava esses textos no relatório.
5. `persistence/build-analytical-output.ts` copiava `publishedMarkdown` para
   `analysis_markdown` e `report.markdown`.
6. `src/server/meta-ai.server.ts` persistia o mesmo Markdown na coluna
   `analysis_markdown`.
7. `integrations/chatgpt/payload.ts` expunha a coluna e o relatório persistido ao
   tool existente.

Assim, a validação de item não era uma fronteira de publicação: texto livre ainda
atravessava o compositor depois dela.

### Causas-raiz da execução `6ea98229-a59b-4f10-8811-dea584f33583`

| Sintoma | Causa comprovada | Consequência |
|---|---|---|
| Etapa 1 truncada | `working.stage1_markdown` era sanitizado e concatenado; não havia proveniência estrutural nem gate de truncamento | trecho IA truncado virou conteúdo persistido |
| “abaixo da média” publicado | claim legado podia continuar `descriptive`; o renderer publicava `claim.text`; trace CTR E1 validava apenas o valor próprio, não a comparação | juízo E2 foi elevado indevidamente por evidência E1 |
| `COMPLETED` indevido | `resolveAnalyticalStatus` rodava antes de qualquer gate do artefato e equivalia “há aprovados sem descartes” a relatório válido | execução inconsistente foi marcada concluída |

**Confiança:** alta. Os três caminhos estavam diretamente presentes no fluxo
executado e foram reproduzidos por regressões locais.

## Todos os ingressos de texto no relatório/payload

| Ingresso | Antes | Depois |
|---|---|---|
| `stage1_markdown` IA | publicado após sanitização | armazenável em `ai_original`; nunca renderizado |
| `stage2_markdown` / `stage4_markdown` IA | parseados; caminhos auxiliares legados existiam | nunca entram na fronteira |
| `observations[].text` | publicado por `renderClaimsMarkdown` | somente normaliza operação; renderer usa registry/IR |
| `executive_points[].text` | publicado no resumo | resumo é projeção de IDs IR aprovados |
| `recommended_action` | título publicável | somente classifica IR; ação E1 vira MONITOR neutro |
| `evidence[]`, `hypothesis`, `validation_criterion` | publicados pelo compositor | não são copiados para Markdown |
| fallback legado | produtor alternativo de Markdown | removido do índice/caminho ativo |
| Claim IR explícito | não era parseado pelo envelope | parseado, validado, recuperado e revalidado |
| coluna `analysis_markdown` | gravada sempre | vazia se gate falhar; publicada só na escrita atômica |
| payload ChatGPT | fallback legado por presença de Markdown | v1.3 só expõe `publication_status=published` |

## Contratos implementados

- Claim IR persistido nos estados `proposed`, `normalized`, `validated`,
  `recovered`, `approved` e `rejected`.
- E0–E3 recalculado no backend; `requested_evidence_level` nunca prova nada.
- E1 exige trace Meta, entidade, métrica e integridade verificáveis.
- E2 exige `comparison_ref` para trace Meta comparável validado.
- E3 exige comparação validada e referências métricas; caso contrário a
  intervenção é descartada ou recuperada como MONITOR E1 neutro.
- Quatro eixos persistidos: execution, analytical, data quality e publication.
- `buildValidatedReport` devolve `pending_persist`, nunca `published`.
- A promoção para `published` exige gate ok, status analítico diferente de
  `FAILED` e acontece no mesmo update que grava o artefato.

## Caminhos legados eliminados

- `validation/orchestrate.ts` não chama mais sanitizador/compositor narrativo.
- `report/index.ts` não exporta mais `composePublishedMarkdown`,
  `composeExecutiveFromApproved`, `renderClaimsMarkdown` ou o fallback legado.
- `pipeline/run-meta-analysis.ts` persiste Claim IR + resultado do gate e nunca
  assume publicação concluída.
- `compose-published-markdown.ts` e `deterministic-fallback.ts` permanecem apenas
  como compatibilidade histórica sem export público e lançam
  `legacy_publication_path_disabled`; não podem produzir artefato.

## Compatibilidade

- Tool, endpoint e autenticação do plugin ChatGPT não foram alterados.
- Campos v1.3 são aditivos.
- Histórico v1.2 sem `publication_status` continua legível.
- `protocol_version`/`engine_version`: `1.3.0`.
- `data_contract_version`: `1.2.0`.
- `analysis_format`: `nex_intelligence_analysis_v1_3_0`.
