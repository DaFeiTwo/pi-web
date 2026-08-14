# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install full dependencies (dev deps are needed by `next build`).
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source and build the production bundle.
COPY . .
RUN npm run build

# NOTE: we intentionally do NOT run `npm prune --omit=dev`.
# `next start` loads next.config.ts at runtime, which Next parses via `jiti`
# (pulled in as a dev dependency through @tailwindcss/node). Pruning dev deps
# removes jiti and makes startup fail with "Cannot find module 'jiti'".


# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runner

# git + ca-certificates: the in-process agent shells out to git and calls LLM
# providers over HTTPS. Add anything else your tools rely on here.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=30141 \
    PI_WEB_HOSTNAME=0.0.0.0 \
    PI_WEB_NO_OPEN=1 \
    HOME=/data

WORKDIR /app

# Copy only the artifacts required to run `next start` via the project launcher.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json

# pi reads/writes its state under $HOME (~/.pi, ~/.agents, ~/pi-cwd-*).
# Mount a volume here to persist sessions, auth and models config.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 30141

# bin/pi-web.js runs `next start` and propagates PI_WEB_HOSTNAME to the
# request-security layer. --no-open is redundant with PI_WEB_NO_OPEN but explicit.
CMD ["node", "bin/pi-web.js", "--hostname", "0.0.0.0", "--no-open"]
