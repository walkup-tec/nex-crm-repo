# Estado atual

## Concluído

- Design system, site institucional, área do cliente e área Master
- Autenticação e recuperação de senha
- Esquema multiempresa e políticas no Supabase
- Build de produção Node validado localmente (`NITRO_PRESET=node-server`)
- `Dockerfile` para o EasyPanel

## Em andamento

- Publicação do app na VPS pelo EasyPanel
- Instalar uma vez, como root no VPS, o serviço `nex-traefik-persist`. O script está em `scripts/nex-traefik-persist.sh`. Sem ele, cada Implantar volta 502.

## Chatbot — Fase 1

- A tela Conexão pede nome de atendimento e número, pede o QR Code à Evolution e mostra um card por número. Quando o QR é lido, o card recebe a tag Conexão finalizada e o nome é enviado ao perfil do WhatsApp.
- Conexão e Caixa de Entrada leem e gravam `chatbot_connections`, `chatbot_contacts`, `chatbot_conversations` e `chatbot_messages`.
- A Evolution API é chamada só no servidor. O webhook público é `POST /api/chatbot/evo`.
- A migração `drizzle/migrations/0010_chatbot_attendance.sql` precisa ser aplicada no Supabase. O deploy do EasyPanel não executa SQL.
- Fila, Kanban, clientes, produtos, agendamentos, automações e relatórios ainda usam o estado da sessão.

## Career / ChatGPT MCP (pré-push 2026-11-17)

- OAuth oficial implementado localmente: `authorization_code` + PKCE S256, AS/PRM, JWT com `CAREER_MCP_OAUTH_SIGNING_SECRET` separado do Bearer.
- Testes locais Career (oauth/mcp/access): ok. Diff separado de Créditos Meta / FR Seguradora.
- Produção ainda sem o patch: `/.well-known/oauth-*` = 404; OAuth metadata cai no splat autenticado.
- Pós-deploy: setar `CAREER_MCP_OAUTH_SIGNING_SECRET` no EasyPanel; validar initialize/tools/list/health/companies_list remotos; ChatGPT Web só se a conta permitir MCP privado.

## Pendente

- Credenciais e serviços reais de Meta, Asaas e EVO
- Biblioteca de criativos ligada ao storage em uso de produção
- `SUPABASE_SERVICE_ROLE_KEY` configurada só no painel da VPS
- Push Career OAuth + secret EasyPanel + validação remota / ChatGPT Web
