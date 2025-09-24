-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('LOGIN', 'REFRESH', 'LOGOUT', 'REFRESH_REUSE_BLOCK');

-- CreateEnum
CREATE TYPE "public"."TxType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'ADJUST', 'TRADE_BUY', 'TRADE_SELL', 'MARGIN_LOCK', 'MARGIN_RELEASE', 'REALIZED_PNL');

-- CreateEnum
CREATE TYPE "public"."FundingType" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "public"."FundingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshJti" TEXT NOT NULL,
    "remember" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "public"."TxType" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "balanceAfter" DECIMAL(38,18) NOT NULL,
    "note" TEXT,
    "meta" JSONB,
    "orderId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FundingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."FundingType" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "status" "public"."FundingStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "adminNote" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Favorite" (
    "userId" TEXT NOT NULL,
    "symbols" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."Instrument" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "quoteCcy" TEXT NOT NULL DEFAULT 'USD',
    "contractSize" DECIMAL(38,18) NOT NULL DEFAULT 1,
    "tickSize" DECIMAL(38,18) NOT NULL DEFAULT 0.01,
    "lotStep" DECIMAL(38,18) NOT NULL DEFAULT 0.01,
    "minLot" DECIMAL(38,18) NOT NULL DEFAULT 0.01,
    "leverageMax" INTEGER NOT NULL DEFAULT 400,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "side" "public"."OrderSide" NOT NULL,
    "type" "public"."OrderType" NOT NULL DEFAULT 'MARKET',
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'OPEN',
    "qtyLot" DECIMAL(38,18) NOT NULL,
    "leverageUsed" INTEGER NOT NULL,
    "entryPrice" DECIMAL(38,18) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tpPrice" DECIMAL(38,18),
    "slPrice" DECIMAL(38,18),
    "marginUsd" DECIMAL(38,18) NOT NULL,
    "closePrice" DECIMAL(38,18),
    "closedAt" TIMESTAMP(3),
    "realizedPnlUsd" DECIMAL(38,18),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshJti_key" ON "public"."Session"("refreshJti");

-- CreateIndex
CREATE INDEX "Session_userId_createdAt_idx" ON "public"."Session"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "public"."Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "public"."AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "public"."Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "public"."Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_walletId_createdAt_idx" ON "public"."Transaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_orderId_idx" ON "public"."Transaction"("orderId");

-- CreateIndex
CREATE INDEX "Transaction_walletId_type_createdAt_idx" ON "public"."Transaction"("walletId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "FundingRequest_userId_status_createdAt_idx" ON "public"."FundingRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_key_key" ON "public"."Instrument"("key");

-- CreateIndex
CREATE INDEX "Instrument_isActive_idx" ON "public"."Instrument"("isActive");

-- CreateIndex
CREATE INDEX "Order_userId_status_openedAt_idx" ON "public"."Order"("userId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "Order_instrumentId_status_idx" ON "public"."Order"("instrumentId", "status");

-- CreateIndex
CREATE INDEX "Order_userId_instrumentId_status_idx" ON "public"."Order"("userId", "instrumentId", "status");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FundingRequest" ADD CONSTRAINT "FundingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "public"."Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
