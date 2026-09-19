FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
# Include dependency build-script policy before installing (pnpm 12).
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ .
# NEXT_PUBLIC_* values are inlined at build time.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Start the built app directly: pnpm can attempt dependency installs at runtime.
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
