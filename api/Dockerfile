# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# --- build ---
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
# Prisma CLI'nin bazı işlemlerinde gerekli
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
# Kaynak kod + prisma şeması
COPY . .
# 1) Prisma Client üret (TS tipleri için)
RUN npx prisma generate
# 2) Nest derle
RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

# PID1 için tini, Prisma engine'leri için openssl, sağlık için curl
RUN apk add --no-cache tini openssl curl

# Sadece prod bağımlılıklar
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Prisma şeması (migrate deploy yapacaksan lazım olabilir)
COPY --from=builder /app/prisma ./prisma

# Builder'da üretilen Prisma Client/engine'ler
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Derlenmiş uygulama
COPY --from=builder /app/dist ./dist

# Non-root kullanıcı
RUN addgroup -S app && adduser -S -G app -u 10001 app
USER 10001:10001

EXPOSE 4000
ENTRYPOINT ["tini","--"]
CMD ["node","dist/main.js"]
