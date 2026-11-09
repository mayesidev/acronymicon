ARG ACRONYMICON_VERSION=development

FROM node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d AS development-dependencies-env
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
WORKDIR /app
RUN npm install --global --ignore-scripts "$(node --print "require('./package.json').packageManager.split('+')[0]")" \
  && pnpm install --frozen-lockfile

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
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:088a01637f22908632ba09018be2e0b516f2fa6f7869c191d29491139db43c78
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
