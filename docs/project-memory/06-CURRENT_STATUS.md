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

## Pendente

- Credenciais e serviços reais de Meta, Asaas e EVO
- Biblioteca de criativos ligada ao storage em uso de produção
- `SUPABASE_SERVICE_ROLE_KEY` configurada só no painel da VPS
