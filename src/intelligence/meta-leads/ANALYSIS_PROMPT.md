# ANALYSIS_PROMPT — Meta Ads desempenho v1.1.6

Espelho: `protocol.ts` → `META_AI_ANALYSIS_PROMPT`.

JSON `nex_intelligence_analysis_v1_1_6` com `observations[]`, `recommendations[]`, `executive_points[]` e `metric_traceability`.
Enums: `action_kind` ∈ scale_budget|pause|replace_creative|test|monitor|other; `confidence` ∈ low|medium|high.
`entity_id` da conclusão = `entity_id` de cada `trace_id` referenciado = entidade nomeada no texto.
Recuperação: seções validadas independentemente; máx. 1 regeneração estrutural ou de conteúdo.
