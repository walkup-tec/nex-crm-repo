# NEX Intelligence — Protocolo de Análise Meta Ads v1.1.8

Protocolo analítico Meta-only (linha 1.1) com motor **1.1.8**, evidências **E0–E3** e **CMS-E1**.

## CMS-E1 — condição mínima de suficiência (monitor)

Recomendação `action_kind=monitor` pode ser aprovada com **uma** métrica relevante válida (ex.: CTR com `trace_id` PASS na entidade/período corretos).

Se a IA enviar CTR válido + CPC sem rastreabilidade:

- preserva CTR;
- remove CPC e evidências dependentes;
- atualiza `indicators_used`, `evidence`, `trace_ids`, `used_by`;
- reescreve ação/critério de forma neutra;
- **não** regenera a IA se a recuperação for suficiente;
- **não** aplica a intervenções E2/E3.

## Evidências objetivas (1.1.7+)

E1 = fatos/monitor; E2 = comparação; E3 = intervenção. CTR isolado não autoriza criativo/orçamento.

## Proteções anteriores

Preserva 1.1.1–1.1.7 (data_quality, schema recovery, binding entidade↔trace, Meta-only).
