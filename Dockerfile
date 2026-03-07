# Build stage — needs Bun for install + build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production stage — only needs Node to run the compiled output
FROM node:22-alpine

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package.json bun.lock ./

# Install production deps with npm (no Bun needed at runtime)
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

RUN mkdir -p /app/.voltagent && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3141

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
