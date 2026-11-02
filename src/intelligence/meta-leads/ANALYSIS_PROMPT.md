# ANALYSIS_PROMPT — Meta Ads desempenho v1.1.3

Espelho executável: `protocol.ts` → `META_AI_ANALYSIS_PROMPT`.

Saída obrigatória: JSON estruturado (`nex_intelligence_analysis_v1_1_3`) com `observations[]`, `recommendations[]`, `executive_points[]` (e `stage1_markdown`).

O NEX valida determinísticamente recomendações e conclusões e publica apenas conteúdo `APPROVED`. Markdown bruto das etapas 2/4 não é publicado sem sanitização.
