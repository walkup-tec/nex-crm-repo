# LOG — Status por etapa da execução + copiar ID

## Contexto do pedido

Melhorar a barra de **Execução** do NEX Intelligence (laboratório Meta IA):

1. Exibir status **por etapa** (Andamento / Concluído / Erro) com ícones.
2. Ao clicar no **ID** da execução, copiar para a área de transferência (para colar no GPT, etc.).

## Ações executadas

- Persistência de progresso do pipeline durante `runAndPersistAnalysis` (sem migração SQL).
- Novo componente de UI `ExecutionPipelineStatus`.
- Integração no `NexIntelligenceWorkspace` (poll atualiza etapas).
- Teste unitário `progress.test.ts`.

## Solução implementada

### Etapas rastreadas

1. Coleta Meta  
2. Qualidade dos dados  
3. Análise IA  
4. Publicação  

### Ícones

- Spinner: Andamento  
- Check verde: Concluído  
- X vermelho: Erro  

### Persistência

Progresso gravado em `output_json.pipeline_progress` (atualizado entre etapas). Em falha, a etapa corrente fica `error` com mensagem truncada. Histórico sem progresso: inferência a partir de `status`/`account_id`/`model`/markdown.

### Copiar ID

Botão no UUID: `navigator.clipboard.writeText` + fallback `execCommand('copy')`; feedback “ID copiado”.

## Arquivos criados/alterados

- `src/lib/nex-intelligence/pipeline/progress.ts` (novo)
- `src/lib/nex-intelligence/pipeline/progress.test.ts` (novo)
- `src/components/nex/intelligence/ExecutionPipelineStatus.tsx` (novo)
- `src/server/meta-ai.server.ts`
- `src/lib/meta-ai-calibration.ts`
- `src/lib/nex-intelligence/persistence/map-row.ts`
- `src/components/nex/intelligence/NexIntelligenceWorkspace.tsx`
- `src/lib/nex-intelligence/index.ts`
- `scripts/run-unit-tests.mjs`
- testes de fixture `MetaAiExecutionDetail` (+ `pipelineProgress`)

## Como validar

```bash
npx tsx src/lib/nex-intelligence/pipeline/progress.test.ts
```

No laboratório: gerar análise → ver etapas mudando no poll; falhar propositalmente (ex.: conta inválida) → etapa com X vermelho; clicar no ID → “ID copiado”.

## Segurança

Mensagens de erro truncadas; tokens Meta não entram no progresso.

## Palavras-chave

`pipeline_progress`, `ExecutionPipelineStatus`, `copiar ID`, `meta_ai_executions`, `NexIntelligenceWorkspace`, `Coleta Meta`, `Análise IA`
