ARG ACRONYMICON_VERSION=development

FROM node:26.13.0-trixie-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS development-dependencies-env
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM development-dependencies-env AS build-env
ARG ACRONYMICON_VERSION
ENV VITE_ACRONYMICON_VERSION=$ACRONYMICON_VERSION
COPY . /app/
RUN pnpm run build \
  && pnpm prune --prod \
  && find node_modules/better-sqlite3/prebuilds \
    -type f ! -name 'linux-*.node' -delete \
  && mkdir -p /app/runtime-data

# Keep the shell, package managers, build tools, and development dependencies
# out of the non-root runtime image.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:a6c34457f6da4295807e051411c7783739c65b997a324fed14e4fa292615ae91
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build-env --chown=65532:65532 /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/
COPY --from=build-env --chown=65532:65532 /app/node_modules /app/node_modules
COPY --from=build-env --chown=65532:65532 /app/build /app/build
COPY --from=build-env --chown=65532:65532 /app/drizzle /app/drizzle
COPY --from=build-env --chown=65532:65532 /app/runtime-data /data
COPY --chown=65532:65532 ./seeds /app/seeds
WORKDIR /app
EXPOSE 3000
CMD ["node_modules/@react-router/serve/bin.cjs", "./build/server/index.js"]
