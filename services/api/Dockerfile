FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/player/package.json apps/player/package.json
COPY packages/composition/package.json packages/composition/package.json
COPY packages/entitlements/package.json packages/entitlements/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY services/api/package.json services/api/package.json
COPY infrastructure/package.json infrastructure/package.json

COPY packages/composition packages/composition
COPY packages/entitlements packages/entitlements
COPY services/api services/api

RUN npm ci \
  && chmod +x /app/services/api/docker-entrypoint.sh \
  && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["/app/services/api/docker-entrypoint.sh"]
CMD ["npm", "run", "start", "-w", "@ticker-cms/api"]
