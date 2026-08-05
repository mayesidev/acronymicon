FROM node:24-bookworm-slim AS development-dependencies-env
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM development-dependencies-env AS build-env
COPY . /app/
RUN pnpm run build \
  && pnpm prune --prod \
  && rm -r node_modules/better-sqlite3/prebuilds \
  && pnpm --dir node_modules/better-sqlite3 run build-release

# Keep build tools and development dependencies out of the runtime image.
FROM node:24-bookworm-slim
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build-env /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/
COPY --from=build-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/drizzle /app/drizzle
COPY ./scripts/import-acronyms.mjs /app/scripts/
COPY ./seeds /app/seeds
WORKDIR /app
EXPOSE 3000
CMD ["node", "node_modules/@react-router/serve/bin.cjs", "./build/server/index.js"]
