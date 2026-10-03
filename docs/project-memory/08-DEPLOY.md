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

A imagem escuta em `0.0.0.0:3000`. No EasyPanel, deixe um único domínio apontando para `http://nex_crm:3000`. Um segundo domínio fica com o IP antigo do container e responde 502 depois de cada implantação.

A service role fica só nessas variáveis. Não usar prefixo `VITE_` nela.

## Domínio

No Registro.br, manter os servidores DNS do próprio Registro.br e criar registro A do domínio e de `www` para o IP público da VPS. No EasyPanel, associar esse domínio ao app `nex` e ligar o HTTPS.

## Checklist

1. `git pull` em `E:\01A-Drax-Servidor\Nex` para trazer o `Dockerfile`.
2. Criar o app no EasyPanel com a tabela acima.
3. Preencher as variáveis, inclusive a service role.
4. Confirmar o registro A no Registro.br.
5. Associar o domínio e o HTTPS no app.
6. Abrir o site e a rota `/auth`.

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
