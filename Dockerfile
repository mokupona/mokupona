# base node image
FROM node:24-bookworm-slim AS base

# set for base and all layer that inherit from it
ENV NODE_ENV=production

# Install openssl for Prisma, sqlite3 for the database-cli shortcut, logrotate
# and cron for log rotation and retention
RUN apt-get update && apt-get install -y openssl sqlite3 logrotate cron

# Install all node_modules, including dev dependencies
FROM base AS deps

WORKDIR /myapp

ADD package.json package-lock.json .npmrc ./
RUN npm ci --include=dev

# Setup production node_modules
FROM base AS production-deps

WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules
ADD package.json package-lock.json .npmrc ./
RUN npm prune --omit=dev

# Build the app
FROM base AS build

WORKDIR /myapp
# Prisma config resolves DATABASE_URL during the image build, before runtime env
# vars exist. Use a local SQLite path here; the host sets the real runtime value.
ENV DATABASE_URL=file:./prisma/data.db

COPY --from=deps /myapp/node_modules /myapp/node_modules

ADD prisma .
RUN npx prisma generate

ADD . .
RUN npm run build

# Finally, build the production image with minimal footprint
FROM base

ENV NODE_ENV="production"

# add shortcut for connecting to database CLI
RUN echo "#!/bin/sh\nset -x\nsqlite3 \$DATABASE_URL" > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli

COPY logrotate.conf /etc/logrotate.d/mokupona
# Debian runs logrotate once a day at 06:25, too coarse for the maxsize bound
RUN mv /etc/cron.daily/logrotate /etc/cron.hourly/logrotate

WORKDIR /myapp

COPY --from=production-deps /myapp/node_modules /myapp/node_modules
# COPY --from=build /myapp/node_modules/.prisma /myapp/node_modules/.prisma

COPY --from=build /myapp/build/server /myapp/build/server
COPY --from=build /myapp/build/client /myapp/build/client
COPY --from=build /myapp/package.json /myapp/package.json
COPY --from=build /myapp/start.sh /myapp/start.sh
COPY --from=build /myapp/prisma /myapp/prisma
COPY --from=build /myapp/prisma.config.ts /myapp/prisma.config.ts
# ops scripts run inside the production container via tsx (a runtime dep for
# this reason); they import app/ sources through the tsconfig path alias
COPY --from=build /myapp/scripts /myapp/scripts
COPY --from=build /myapp/app /myapp/app
COPY --from=build /myapp/tsconfig.json /myapp/tsconfig.json

ENTRYPOINT [ "./start.sh" ]
