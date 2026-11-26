ARG ACRONYMICON_VERSION=development

FROM node:26.13.1-trixie-slim@sha256:abe7e5a82b61a8ef67b315b85497c9e65173387ccf2f4a029248184b8e020be5 AS development-dependencies-env
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl libatomic1 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
WORKDIR /app
RUN curl --fail --silent --show-error --location https://get.pnpm.io/install.sh --output /tmp/install-pnpm.sh \
  && PNPM_VERSION="$(node --print "require('./package.json').packageManager.split('@')[1].split('+')[0]")" \
    ENV=/tmp/pnpm-env SHELL=/bin/sh sh /tmp/install-pnpm.sh \
  && rm -f /tmp/install-pnpm.sh /tmp/pnpm-env \
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
FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:a84242e747fbb5aaaa0180c273b6f7130ca34b3300082192ef58eea96089eb3c
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
