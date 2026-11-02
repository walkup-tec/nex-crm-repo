# NEX Intelligence — Protocolo de Análise Meta Ads v1.1.0

## Escopo

Motor de análise de **desempenho** de campanhas Meta Ads.

Fonte exclusiva: **Meta Marketing API** (contrato NEX Meta Analysis V1).

Níveis: Campanha, Conjunto de anúncios e Anúncio.

Não altera campanhas na Meta. Não inventa métricas. `null` ≠ `0`.

## Fonte de dados

Usar apenas indicadores da Meta: objetivo, evento de otimização, resultados reportados, custo por resultado, investimento, impressões, alcance, frequência, CTR, CPC, CPM, cliques e evolução temporal.

**Não depender** de dados comerciais externos:

- Vendas realizadas
- Valores negociados
- Agendamentos
- Leads qualificados no CRM
- Atendimento pelo chatbot
- Informações preenchidas manualmente pelo cliente

A ausência desses dados **não** gera alertas, ressalvas nem impede a análise.

## Interpretação de resultados

Interpretar cada resultado conforme o evento efetivamente reportado pela Meta.

Exemplo: conversas iniciadas **não** devem ser automaticamente denominadas vendas ou leads qualificados.

## Princípios

1. Usar apenas o contrato NEX Meta Analysis V1.
2. Não confundir cliques totais com cliques no link.
3. Não somar alcance entre entidades.
4. Não reaggregar médias/percentuais como totais.
5. Validar consistência entre campanhas, conjuntos, anúncios e séries diárias antes de concluir.
6. Distinguir divergências de extração, atribuição e agregação.
7. Recomendações fundamentadas em evidências Meta (volume, período, maturidade, comparabilidade).
8. Não recomendar alterações com base em um único indicador isolado.

## Qualidade (calibração)

Critérios 0–5: precisão, consistência, fundamentação, limitações, aplicabilidade.
