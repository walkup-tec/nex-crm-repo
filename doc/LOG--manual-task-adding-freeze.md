# LOG — Freeze ao adicionar tarefa manual

## Sintoma
Botao Aplicar do rascunho manual ficava em reticencias e a linha nao saia do estado de salvamento.

## Causa
`onAddManualTask` setava `addingTask=true` sem `try/finally`. Se `syncIntelligenceTasksFn` rejeitasse ou demorasse demais, a UI nao liberava o estado. No ambiente local, `SUPABASE_SERVICE_ROLE_KEY` tambem esta ausente no `.env`, o que faz a persistencia falhar no servidor.

## Correcao
- `finally` limpa `addingTask` / `busyTaskId`
- timeout de 45s no sync da tarefa manual
- rascunho so fecha quando o save retorna sucesso
- feedback visual `Salvando` com spinner

## Keywords
tarefa manual, addingTask, OptimizationTaskList, freeze, syncIntelligenceTasksFn
