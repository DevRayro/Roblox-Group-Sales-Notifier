# Multi-stage build keeps the final image small.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# tini is a minimal init that forwards signals correctly so SIGTERM gets
# delivered to Node when the platform restarts the container.
RUN apk add --no-cache tini && \
    mkdir -p /app/data && \
    chown -R node:node /app

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node

# Persist sale-tracking state across restarts. On Northflank, attach a
# volume to /app/data; on other platforms (Fly, Koyeb) declare an equivalent
# mount.
VOLUME ["/app/data"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
