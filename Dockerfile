# Bun runs the TypeScript source directly — no build stage needed
FROM oven/bun:1-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

RUN addgroup -g 1001 -S bunjs && adduser -S bunjs -u 1001 \
    && mkdir -p /app/.voltagent && chown -R bunjs:bunjs /app

USER bunjs

EXPOSE 3141

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "src/index.ts"]
