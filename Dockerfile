FROM node:24-bookworm-slim AS development-dependencies-env
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY . /app
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM node:24-bookworm-slim AS production-dependencies-env
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY ./package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
WORKDIR /app
RUN pnpm install --prod --frozen-lockfile \
  && rm -r node_modules/better-sqlite3/prebuilds \
  && pnpm --dir node_modules/better-sqlite3 run build-release

FROM node:24-bookworm-slim AS build-env
RUN corepack enable
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable
COPY ./package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/drizzle /app/drizzle
COPY ./scripts/import-acronyms.mjs /app/scripts/
COPY ./seeds /app/seeds
WORKDIR /app
EXPOSE 3000
CMD ["pnpm", "run", "start"]
