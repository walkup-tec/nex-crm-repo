# Arquitetura

A aplicação é um único serviço Node. Banco, autenticação e arquivos ficam no Supabase já ligado ao projeto.

## Superfícies

- Site institucional público
- Acesso, recuperação e redefinição de senha
- Área do cliente, isolada por organização
- Área Master, com visão global

## Servidor

- `src/server.ts` envolve o entry SSR
- `src/start.ts` aplica autenticação Supabase e CSRF nas server functions
- Credenciais de Meta, Asaas e EVO ficam só no servidor
- Dados de demonstração ficam fora dos componentes de interface

## Produção

O build da Lovable publica no Cloudflare. O build da VPS usa `NITRO_PRESET=node-server` e gera `.output/server/index.mjs`, que escuta `PORT` (padrão 3000) em `HOST`.
