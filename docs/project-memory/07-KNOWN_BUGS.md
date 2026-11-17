# Problemas conhecidos

## ChatGPT Web — MCP privado indisponível sem sessão / plano (bloqueio registrado)

Data: 2026-11-17.

Comportamento: não foi possível confirmar na conta do usuário se o ChatGPT Web permite adicionar MCP privado. A sessão em chatgpt.com está deslogada (só “Log in / Sign up”); Settings/Plugins não expõem conectores MCP sem autenticação. Pela documentação OpenAI, MCP custom completo (write) exige Business/Enterprise/Edu + Developer Mode; Plus/Pro ficam limitados a read/fetch.

Mitigação: o backend Career já implementa OAuth 2.1 (`authorization_code` + PKCE S256) + PRM/AS metadata; REST/MCP direto seguem com Bearer. Validação pós-deploy no ChatGPT Web depende de login na conta/workspace elegível. Enquanto isso, o painel Master → Candidatura exige auth (redirect para `/auth` confirmado).

## Pós-deploy 2026-11-17 — Traefik 404 + patch OAuth ainda local

Evidência:
- `https://app.nexmeta.com.br/*` → Traefik `404 page not found`
- `http://72.60.51.127:30320/health` → `200` (`deployMarker` NEX-DEPLOY-METAI123)
- MCP em `:30320` → `401` sem Bearer (rota viva), **sem** `WWW-Authenticate` OAuth
- `/oauth/*` e `/.well-known/oauth-*` no host → splat/`404` (patch OAuth **não** está em `main`/produção)
- Working tree local ainda contém o patch OAuth (não commitado/pushado)
- SSH `root@srv1261237.hstgr.cloud` → `Permission denied (publickey)` nesta sessão

Ação: (1) republicar Traefik hostgw (`nex-traefik-persist.sh --once` no VPS); (2) commit+push do patch Career OAuth; (3) setar `CAREER_MCP_OAUTH_SIGNING_SECRET`; (4) revalidar MCP autenticado + ChatGPT Web.

## Webhook Evolution com MESSAGES_REACTION — corrigido

Comportamento: `webhook/set` falhava com 400 porque `MESSAGES_REACTION` não existe no enum da Evolution. A instância ficava sem webhook (`find` = null). A caixa enchia via import (sem acionar bot): dezenas de mensagens `in` e zero `out`. Confirmado na Keilla (org `eb004e0d…`, instância `nexeb004e0da25emwc97fco`) em 2026-11-12.

Correção: remover `MESSAGES_REACTION` dos eventos; reaplicar webhook nas instâncias `nex*`. Após o set manual, o bot voltou a enviar (fora do expediente / menu).

## Bots sem canal após bind (d32b961) — corrigido no código

Comportamento: após o bind bot↔canal, fluxos ativos salvos antes da mudança (sem `graph.connectionIds`) deixavam de disparar em qualquer WhatsApp — inclusive MMS Master. Fluxos só com “Palavra-chave” também não respondem a texto de teste que não contenha o gatilho exato (ex.: `#CG` ≠ `#CG01`).

Correção: legado sem `connectionIds` volta a responder em qualquer canal da empresa; canal explícito tem prioridade; ao excluir canal o id é removido do fluxo (e o bot desativa se ficar sem canal).

## Cada Implantar devolve 502

Comportamento: depois de Implantar ou redeploy no EasyPanel, `https://app.nexmeta.com.br` e `https://nexmeta.com.br` respondem Bad Gateway.

Causa conhecida: o painel remove a publicação no modo host e volta o Traefik para `http://nex_crm` e `http://nex_site`. Essa rede não responde neste VPS.

Solução temporária: republicar `30320` (app) e `30321` (site) no modo host e apontar o Traefik para `http://172.17.0.1:<porta>/`.

Situação atual: o script `scripts/nex-traefik-persist.sh` faz isso sozinho quando o serviço `nex-traefik-persist` está ativo no VPS. Enquanto a instalação não for feita, o 502 volta em todo deploy.
