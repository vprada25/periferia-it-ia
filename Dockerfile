# One Render service, three processes (ADR-007/017): web (Next.js on Node) + backend and agent (Bun).
FROM node:22-bookworm-slim AS node

FROM oven/bun:1.4.4
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app

# Install dependencies first to leverage the layer cache.
COPY package.json bun.lock bunfig.toml .npmrc tsconfig.base.json tsconfig.json ./
COPY app/contracts/package.json app/contracts/
COPY app/backend/package.json app/backend/
COPY app/agent/package.json app/agent/
COPY app/web/package.json app/web/
RUN bun install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

ENV NODE_ENV=production \
    PORT=3000 \
    BACKEND_PORT=4000 \
    AGENT_PORT=4100 \
    BACKEND_URL=http://127.0.0.1:4000 \
    AGENT_URL=http://127.0.0.1:4100
EXPOSE 3000
CMD ["bun", "scripts/start.ts"]
