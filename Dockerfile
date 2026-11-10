FROM node:22-bookworm AS build

WORKDIR /app

# Copy manifests first so Docker can reuse the dependency layer.
COPY artefato/package.json artefato/package-lock.json ./artefato/
COPY artefato/packages/core/package.json ./artefato/packages/core/package.json
COPY artefato/packages/server/package.json ./artefato/packages/server/package.json
COPY artefato/packages/web/package.json ./artefato/packages/web/package.json

RUN npm ci --prefix artefato

COPY artefato ./artefato
COPY experimentos/cenarios ./experimentos/cenarios

RUN npm run build --prefix artefato \
    && npm prune --omit=dev --prefix artefato

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app/artefato/packages/server

COPY --from=build /app/artefato/package.json /app/artefato/package-lock.json /app/artefato/
COPY --from=build /app/artefato/node_modules /app/artefato/node_modules
COPY --from=build /app/artefato/packages/core/package.json /app/artefato/packages/core/package.json
COPY --from=build /app/artefato/packages/core/dist /app/artefato/packages/core/dist
COPY --from=build /app/artefato/packages/server/package.json /app/artefato/packages/server/package.json
COPY --from=build /app/artefato/packages/server/dist /app/artefato/packages/server/dist
COPY --from=build /app/artefato/packages/server/map /app/artefato/packages/server/map
COPY --from=build /app/artefato/packages/web/dist /app/artefato/packages/web/dist
COPY --from=build /app/experimentos/cenarios /app/experimentos/cenarios

VOLUME ["/app/artefato/packages/server/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/api/routing-status').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "dist/index.js"]
