# ANALYSIS_PROMPT — Meta Ads desempenho v1.1.2

Espelho executável: `protocol.ts` → `META_AI_ANALYSIS_PROMPT`.

Saída obrigatória: JSON estruturado (`nex_intelligence_analysis_v1_1_2`) com `stage1_markdown`, `stage2_markdown`, `recommendations[]`, `stage4_markdown`.

Etapas: (1) validação/`data_quality`, (2) análise Meta-only, (3) recomendações estruturadas condicionadas a métricas verificadas, (4) resumo executivo sem cobrar dados comerciais e sem reproduzir ações inválidas.

O NEX aplica validação determinística pós-IA e publica apenas recomendações `APPROVED`.
