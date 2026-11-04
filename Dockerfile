# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install from the lockfile without running dependency lifecycle scripts.
# node-pty ships Linux x64/arm64 prebuilds; the root postinstall only fixes
# macOS binary permissions, so it is not needed in this Linux image.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy the source, build the production bundle, then remove build-only files
# and devDependencies from the runtime dependency tree.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN rm -rf .next/cache \
    && find .next -name '*.js.map' -delete \
    && npm prune --omit=dev


# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runner

# bash is used by the agent's shell tool and terminal; git and CA certificates
# support project operations and HTTPS provider calls.
RUN apt-get update \
    && apt-get install -y --no-install-recommends bash git ca-certificates \
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}`).then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"]

# bin/pi-web.js runs `next start` and propagates PI_WEB_HOSTNAME to the
# request-security layer. --no-open is redundant with PI_WEB_NO_OPEN but explicit.
CMD ["node", "bin/pi-web.js", "--hostname", "0.0.0.0", "--no-open"]
