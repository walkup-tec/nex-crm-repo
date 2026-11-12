# Problemas conhecidos

## Bots sem canal após bind (d32b961) — corrigido no código

Comportamento: após o bind bot↔canal, fluxos ativos salvos antes da mudança (sem `graph.connectionIds`) deixavam de disparar em qualquer WhatsApp — inclusive MMS Master. Fluxos só com “Palavra-chave” também não respondem a texto de teste que não contenha o gatilho exato (ex.: `#CG` ≠ `#CG01`).

Correção: legado sem `connectionIds` volta a responder em qualquer canal da empresa; canal explícito tem prioridade; ao excluir canal o id é removido do fluxo (e o bot desativa se ficar sem canal). Ainda depende de deploy.

## Cada Implantar devolve 502

Comportamento: depois de Implantar ou redeploy no EasyPanel, `https://app.nexmeta.com.br` e `https://nexmeta.com.br` respondem Bad Gateway.

Causa conhecida: o painel remove a publicação no modo host e volta o Traefik para `http://nex_crm` e `http://nex_site`. Essa rede não responde neste VPS.

Solução temporária: republicar `30320` (app) e `30321` (site) no modo host e apontar o Traefik para `http://172.17.0.1:<porta>/`.

Situação atual: o script `scripts/nex-traefik-persist.sh` faz isso sozinho quando o serviço `nex-traefik-persist` está ativo no VPS. Enquanto a instalação não for feita, o 502 volta em todo deploy.
