# Decisões

## 2026-10-02 — Um serviço de aplicação na VPS

Motivo: o esquema depende de `auth.uid()`, RLS do Supabase e do bucket `nex-creatives`. Um container Postgres não substitui isso.

Impacto: no EasyPanel existe só o app Nex. Auth, banco e arquivos continuam no Supabase já conectado.

## 2026-10-02 — Preset Node só no build da VPS

Motivo: o EasyPanel executa um processo Node. O build da Lovable precisa continuar no Cloudflare.

Impacto: o `Dockerfile` define `NITRO_PRESET=node-server`. O ambiente da Lovable ignora essa variável e segue no preset Cloudflare.

## 2026-10-02 — Backend do Traefik pelo gateway do host

Motivo: neste VPS o proxy não alcança o serviço Swarm pela rede overlay. A porta 3000 do host é o EasyPanel. O mesmo servidor já usa `http://172.17.0.1:<porta>/` nos outros sistemas.

Impacto: o app publica `30320 → 30320` e o site publica `30321 → 30321`, ambos no modo host. Os domínios apontam para `http://172.17.0.1:30320/` e `http://172.17.0.1:30321/`. Portas proibidas: 3000 (EasyPanel), 30180 (WABA), 30181 (Evolution), 30300 (outro app) e 30310 (Sinal Verde). Não reiniciar o Traefik para aplicar a troca de URL.

## 2026-10-03 — Persistência da porta após deploy

Motivo: cada Implantar do EasyPanel regrava o Traefik para a rede interna e remove a publicação no host. O domínio responde 502 até alguém republicar a porta.

Impacto: o serviço `nex-traefik-persist` no VPS observa o deploy de `nex_crm` e `nex_site` e reaplica `30320` e `30321` no modo host, com o Traefik em `http://172.17.0.1:<porta>/`. A instalação é única (`--install`). O script não altera a porta quando ela já está correta, para não reiniciar o container em ciclo.
