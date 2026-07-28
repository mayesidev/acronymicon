FROM node:22-bookworm-slim AS development-dependencies-env
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:22-bookworm-slim AS production-dependencies-env
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev \
  && rm -r node_modules/better-sqlite3/prebuilds \
  && npm --prefix node_modules/better-sqlite3 run build-release

FROM node:22-bookworm-slim AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV PORT=3000
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/drizzle /app/drizzle
WORKDIR /app
EXPOSE 3000
CMD ["npm", "run", "start"]
