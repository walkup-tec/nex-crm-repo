# Imagem da VPS (EasyPanel). O build da Lovable ignora NITRO_PRESET e continua no Cloudflare.
FROM oven/bun:1.4.2 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

ENV NITRO_PRESET=node-server
# Variável vazia injetada pela plataforma não pode bloquear o .env (o Vite não sobrescreve env já definido).
RUN bash -lc 'for v in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_PROJECT_ID SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_PROJECT_ID; do if [ -z "${!v:-}" ]; then unset "$v"; fi; done; bun run build'

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    NITRO_HOST=0.0.0.0 \
    PORT=3000
COPY --from=build /app/.output ./.output
COPY docker-entrypoint.mjs /app/docker-entrypoint.mjs
EXPOSE 3000
CMD ["node", "--import", "./docker-entrypoint.mjs", ".output/server/index.mjs"]
