# Integrações

## Supabase

Ativo. URL `https://vshmtfgfbuizwvqxepsv.supabase.co`.

Variáveis de runtime: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Variáveis públicas do build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

A service role só existe no servidor. O `.env` versionado traz a chave publicável. A service role entra no painel da VPS e não no repositório.

## Meta Marketing API

Prevista para sincronizar contas e campanhas. Sem credencial nesta fase.

## Asaas

Prevista para clientes, cobrança mensal, Pix e webhook. Sem credencial nesta fase. O webhook será a fonte de verdade do pagamento.

## EVO API

Prevista para alertas financeiros no WhatsApp. Sem credencial nesta fase.
