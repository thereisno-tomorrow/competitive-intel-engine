# Worker image — long-running background process, no exposed port.
# Single-package repo: imports the existing src/lib pipeline directly and runs it
# under tsx. Adapted from gtm-studio's monorepo worker Dockerfile (simplified).
FROM node:22-slim

WORKDIR /app

# Prisma needs openssl at runtime for the query engine.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (better layer caching). Schema is needed by the postinstall
# `prisma generate`, so copy prisma/ before `npm ci`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Copy the rest of the source and (re)generate the Prisma client into src/generated.
COPY . .
RUN npx prisma generate

# Dev deps (tsx) are needed to run the worker; set production only after install.
ENV NODE_ENV=production
ENV WORKER_AUTOSTART=true

CMD ["npm", "run", "worker"]
