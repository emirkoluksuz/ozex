// src/wallet/wallet.service.ts
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, TxType, OrderStatus } from "@prisma/client";
import { PriceService } from "../price/price.service";
import { Decimal } from "decimal.js"; // ✅ Prisma.Decimal yerine

function num(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private prices: PriceService,
  ) {}

  // ----- Read helpers -----
  async getOrCreateWallet(userId: string) {
    const w = await this.prisma.wallet.findUnique({ where: { userId } });
    if (w) return w;
    return this.prisma.wallet.create({ data: { userId } });
  }

  async getBalance(userId: string) {
    const w = await this.getOrCreateWallet(userId);
    return w.balance.toString();
  }

  /** 🔎 Kullanıcı cüzdan özeti */
  async getOverview(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const balance = num(wallet.balance);

    const opens = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.OPEN },
      include: { instrument: true },
    });

    let marginUsed = 0;
    let unrealized = 0;

    for (const o of opens) {
      const cs = num(o.instrument.contractSize, 1);
      const lot = num(o.qtyLot, 0);
      const ent = num(o.entryPrice, 0);
      const live = this.prices.getPrice(o.instrument.key) ?? ent;
      const dir = o.side === "BUY" ? 1 : -1;

      const pnl = (live - ent) * cs * lot * dir;
      unrealized += pnl;

      marginUsed += num(o.marginUsd, 0);
    }

    marginUsed = round2(marginUsed);
    unrealized = round2(unrealized);

    const equity = round2(balance + unrealized);
    const freeMargin = round2(equity - marginUsed);
    const marginLevel =
      marginUsed > 0 ? round2((equity / marginUsed) * 100) : 0;

    return {
      balanceUSD: round2(balance),
      marginUsd: marginUsed,
      freeMarginUsd: freeMargin,
      assetValue: equity,
      marginLevel,
      unrealizedPnl: unrealized,
      etagSalt: `${Math.round(equity * 100)}:${Math.round(
        marginUsed * 100,
      )}`,
      updatedAt: wallet.updatedAt,
    };
  }

  // ----- Tx helper -----
  private async inTx<T>(
    cb: (tx: Prisma.TransactionClient) => Promise<T>,
    tx?: Prisma.TransactionClient,
  ): Promise<T> {
    if (tx) return cb(tx);
    return this.prisma.$transaction(async (trx) => cb(trx));
  }

  // ----- Internal -----
  private async applyTxn(
    userId: string,
    type: TxType,
    amountStr: string,
    note?: string,
    meta?: any,
    idempotencyKey?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const amount = new Decimal(amountStr); // ✅
    if (amount.isZero()) throw new BadRequestException("Miktar 0 olamaz");

    const MAX_RETRY = 5;

    return this.inTx<string>(async (trx) => {
      if (idempotencyKey) {
        const existing = await trx.transaction.findUnique({
          where: { idempotencyKey },
          select: { balanceAfter: true },
        });
        if (existing) return existing.balanceAfter.toString();
      }

      for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        const wallet =
          (await trx.wallet.findUnique({ where: { userId } })) ??
          (await trx.wallet.create({
            data: { userId, balance: new Decimal(0), version: 1 },
          }));

        const next = new Decimal(wallet.balance).plus(amount);
        if (next.lt(0))
          throw new BadRequestException("Yetersiz bakiye");

        const updated = await trx.wallet.updateMany({
          where: { id: wallet.id, version: wallet.version },
          data: { balance: next, version: { increment: 1 } },
        });

        if (updated.count !== 1) {
          if (attempt === MAX_RETRY)
            throw new Error("Concurrency conflict, please retry");
          continue;
        }

        try {
          await trx.transaction.create({
            data: {
              walletId: wallet.id,
              type,
              amount,
              balanceAfter: next,
              note,
              meta,
              idempotencyKey: idempotencyKey ?? undefined,
            },
          });
        } catch (e: any) {
          if (e?.code !== "P2002") throw e;
        }

        return next.toString();
      }

      throw new Error("Failed to apply transaction");
    }, tx);
  }

  // ----- Public API -----
  async adminAdjust(
    userId: string,
    amount: string,
    note?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.applyTxn(
      userId,
      "ADJUST",
      amount,
      note,
      undefined,
      undefined,
      tx,
    );
  }

  async applyApprovedDeposit(
    userId: string,
    amount: string,
    fundingRequestId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.applyTxn(
      userId,
      "DEPOSIT",
      amount,
      "Deposit approved",
      { fundingRequestId },
      fundingRequestId,
      tx,
    );
  }

  async applyApprovedWithdraw(
    userId: string,
    amount: string,
    fundingRequestId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const neg = new Decimal(amount).neg().toString(); // ✅
    return this.applyTxn(
      userId,
      "WITHDRAW",
      neg,
      "Withdraw approved",
      { fundingRequestId },
      fundingRequestId,
      tx,
    );
  }
}
