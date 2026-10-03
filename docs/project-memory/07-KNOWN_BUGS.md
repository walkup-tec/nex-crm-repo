# Problemas conhecidos

## Cada Implantar devolve 502

Comportamento: depois de Implantar ou redeploy no EasyPanel, `https://app.nexmeta.com.br` e `https://nexmeta.com.br` respondem Bad Gateway.

Causa conhecida: o painel remove a publicação no modo host e volta o Traefik para `http://nex_crm` e `http://nex_site`. Essa rede não responde neste VPS.

Solução temporária: republicar `30320` (app) e `30321` (site) no modo host e apontar o Traefik para `http://172.17.0.1:<porta>/`.

Situação atual: o script `scripts/nex-traefik-persist.sh` faz isso sozinho quando o serviço `nex-traefik-persist` está ativo no VPS. Enquanto a instalação não for feita, o 502 volta em todo deploy.
