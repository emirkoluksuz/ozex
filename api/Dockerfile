# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# --- build ---
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
# Prisma CLI'nin çalışması ve node_modules erişimi için
COPY --from=deps /app/node_modules ./node_modules
# Kaynak kod + prisma şeması
COPY . .
# ⬇️ ÖNCE Prisma Client üret (TS build'in tipleri görmesi için)
RUN npx prisma generate
# ⬇️ SONRA Nest derle
RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

# Prisma runtime bağımlılıkları (openssl) ve sağlık kontrolü için curl
RUN apk add --no-cache openssl curl

# Sadece prod bağımlılıklar
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# (Opsiyonel ama iyi) prisma klasörünü kopyala: container içinde migrate deploy yapacaksan lazım olur
COPY --from=builder /app/prisma ./prisma

# Builder'da üretilmiş Prisma Client ve engine'leri runtime'a taşı
# (runtime'da generate çalıştırmıyoruz; devDependency 'prisma' yok)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Derlenmiş dosyalar
COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/main.js"]
