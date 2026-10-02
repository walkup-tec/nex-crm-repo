# Decisões

## 2026-10-02 — Um serviço de aplicação na VPS

Motivo: o esquema depende de `auth.uid()`, RLS do Supabase e do bucket `nex-creatives`. Um container Postgres não substitui isso.

Impacto: no EasyPanel existe só o app Nex. Auth, banco e arquivos continuam no Supabase já conectado.

## 2026-10-02 — Preset Node só no build da VPS

Motivo: o EasyPanel executa um processo Node. O build da Lovable precisa continuar no Cloudflare.

Impacto: o `Dockerfile` define `NITRO_PRESET=node-server`. O ambiente da Lovable ignora essa variável e segue no preset Cloudflare.
