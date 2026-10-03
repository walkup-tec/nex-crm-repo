# Deploy

Hospedagem da aplicação: VPS Hostinger, EasyPanel. Dados: Supabase do projeto.

## Serviço no EasyPanel

Criar um único app.

| Campo | Valor |
|---|---|
| Nome | `nex` |
| Repositório | `walkup-tec/canvas-capturer-pro` |
| Branch | `main` |
| Build | Dockerfile |
| Porta do container | `3000` |

Não criar Postgres, Redis nem Supabase self-hosted.

## Variáveis de runtime

Copiar do projeto Supabase `djskqztincstkwvvjhsb`:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

O EasyPanel injeta `PORT` no container. No host, a publicação que funciona é `30320 → 30320` no modo host para o app (`nex_crm`) e `30321 → 30321` para o site (`nex_site`). O formulário de domínio só tem Protocolo, Porta e Caminho. O destino real fica em `http://172.17.0.1:30320/` e `http://172.17.0.1:30321/`. A rede interna `http://nex_crm:<porta>/` não responde neste VPS e devolve 502. Portas de host proibidas: 3000, 30180, 30181, 30300 e 30310.

A service role fica só nessas variáveis. Não usar prefixo `VITE_` nela.

## Domínio

No Registro.br, manter os servidores DNS do próprio Registro.br e criar registro A do domínio e de `www` para o IP público da VPS. No EasyPanel, associar esse domínio ao app `nex` e ligar o HTTPS.

## Checklist

1. `git pull` em `E:\01A-Drax-Servidor\Nex` para trazer o `Dockerfile`.
2. Criar o app no EasyPanel com a tabela acima.
3. Preencher as variáveis, inclusive a service role.
4. Confirmar o registro A no Registro.br.
5. Associar o domínio e o HTTPS no app.
6. Confirmar que o serviço `nex-traefik-persist` está ativo no VPS. Sem ele, cada Implantar apaga a porta do host e o domínio volta 502.
7. Abrir `https://app.nexmeta.com.br/auth` e `https://nexmeta.com.br`.

## Desenvolvimento local

```sh
bun install
bun run dev
```

Build de produção no mesmo formato da VPS:

```sh
NITRO_PRESET=node-server bun run build
HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs
```

## Depois de cada Implantar

O EasyPanel regrava o Traefik para a rede interna e remove a publicação no host. O serviço `nex-traefik-persist` no VPS observa o deploy de `nex_crm` e `nex_site` e republica sozinho as portas `30320` e `30321` no modo host, além do destino `http://172.17.0.1:<porta>/`. A instalação, uma vez, como root: `nex-traefik-persist.sh --install`. Não reiniciar o Traefik. Não apontar domínio para `http://nex_crm:3000`.
