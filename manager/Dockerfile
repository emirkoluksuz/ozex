# 1) deps
FROM node:20-alpine AS deps
WORKDIR /app
# sharp gibi native modüller için libc6-compat
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# 2) build
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npm run build

# 3) runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
# healthcheck için curl
RUN apk add --no-cache curl libc6-compat
# non-root user
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# standalone çıktı + statikler
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
# izinler
RUN chown -R nextjs:nextjs /app
USER nextjs
EXPOSE 3002
CMD ["node", "server.js"]
