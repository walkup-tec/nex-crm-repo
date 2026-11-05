# Créditos Meta — fluxo sem OAuth/SDK (temporário)

**Atualização:** 2026-11-05  
**Status:** vigente até a Meta aprovar o APP (Live + App Review / Advanced Access).

## Decisão

O menu **Créditos Meta** **não** usa mais login Facebook / OAuth / SDK para recarga.

Motivo: o app Meta em Development/Inactive bloqueava clientes finais (“Aplicativo inativo”). Adicionar cada cliente como Tester **não** é viável. Somos Tech Provider, mas isso **não** libera OAuth para usuários sem role no app enquanto o app não estiver Live e com permissões aprovadas.

## Fluxo atual (produção)

1. Usuário informa o **valor**.
2. Aparece **Adicionar saldo** → abre o `balance_url` cadastrado na conta de anúncio.
3. Usuário paga na Meta (sessão Facebook do próprio navegador basta).
4. Volta ao NEX e confirma **Pagamento Finalizado**.
5. Contabilização de saldo / topup / alertas **permanece a mesma** (`registerMetaCreditTopup`, ledger prepaid, low balance).

## O que foi removido (só do crédito)

- UI “Entrar com o Facebook” em `MetaCredits.tsx`
- `startFacebookLogin` / `startFacebookLoginFn`
- `startSimpleFacebookLogin` e ramo `state` `login.*` no callback OAuth

## O que permanece

- OAuth de **conexão Meta** (MetaConnect / portfólio / contas) — não misturar com crédito.
- `balance_url` por conta no cadastro.
- Leitura/contabilização de saldo e confirmação de topup.

## Retomada (quando a Meta aprovar o APP)

Quando o app estiver **Live**, **Active**, com `ads_read` + `business_management` em Advanced Access (e Business Verification / Data Use Checkup ok):

1. Reavaliar reintroduzir login Facebook no Créditos Meta **só se** ainda agregar valor (hoje o link direto + sessão do browser já leva à tela de pagamento).
2. Se retomar OAuth de crédito: restaurar fluxo popup + `startSimpleFacebookLogin` + ramo `login.` no callback; **não** exigir roles de Tester para cliente final.
3. Até lá: manter este fluxo sem SDK.

## Arquivos-chave

- `src/components/nex/MetaCredits.tsx`
- `src/lib/meta-credit.functions.ts`
- `src/server/meta-credit.server.ts`
- `src/server/meta.server.ts` (connect OAuth continua; login simples de crédito removido)
- `src/routes/auth.meta.callback.tsx`
