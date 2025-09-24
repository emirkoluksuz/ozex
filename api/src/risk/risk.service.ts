import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PriceService } from "../price/price.service";
import { STOP_OUT_PCT, MARGIN_CALL_PCT } from "./risk.constants";

function num(v: any, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

@Injectable()
export class RiskService {
  constructor(private prisma: PrismaService, private prices: PriceService) {}

  /** Kullanıcının açık pozisyonlarının metrikleri */
  async computeUserMetrics(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    const orders = await this.prisma.order.findMany({
      where: { userId, status: "OPEN" },
      include: { instrument: true },
    });

    let locked = 0;
    let uPnL   = 0;

    for (const o of orders) {
      const cs = num(o.instrument.contractSize, 1);
      const lot = num(o.qtyLot);
      const entry = num(o.entryPrice);
      const side = o.side; // BUY / SELL
      const sym  = o.instrument.key.toUpperCase();
      const mkt  = this.prices.getSpot(sym);

      locked += num(o.marginUsd);
      if (mkt != null) {
        const diff = (side === "BUY" ? mkt - entry : entry - mkt);
        uPnL += diff * cs * lot;
      }
    }

    const balance = num(wallet?.balance);
    // Bizde balance, margin lock sonrası “cash” (free cash). Standard equity elde etmek için lock’u ekleyip uPnL da ekliyoruz.
    const equity = balance + locked + uPnL;
    const marginLevelPct = locked > 0 ? (equity / locked) * 100 : Infinity;
    const freeMargin = equity - locked; // = balance + uPnL

    return { balance, locked, uPnL, equity, freeMargin, marginLevelPct, count: orders.length };
  }

  /** Stop-out uygula: level STOP_OUT altındaysa en kötü PnL’den başlayıp kapat */
  async ensureStopOut(userId: string) {
    // Tek txn: fakat birden çok kapama yapacağımız için seri kapama + tekrar hesap yaklaşımı
    // (gap riskine karşı en güvenlisi)
    // Döngü: level < STOP_OUT ise en kötü pozisyonu kapat → tekrar hesapla.
    for (let guard = 0; guard < 50; guard++) {
      const m = await this.computeUserMetrics(userId);
      if (m.locked <= 0 || m.marginLevelPct >= STOP_OUT_PCT) break;

      // Açık emirleri en kötü (en negatif unrealized) olandan kapat.
      const open = await this.prisma.order.findMany({
        where: { userId, status: "OPEN" },
        include: { instrument: true },
      });

      // Eğer fiyat yoksa, kapamayı sağlıklı yapamayız; çıkar.
      const scored = open.map(o => {
        const cs = num(o.instrument.contractSize, 1);
        const lot = num(o.qtyLot);
        const entry = num(o.entryPrice);
        const mkt = this.prices.getSpot(o.instrument.key);
        if (mkt == null) return { o, u: 0, hasPx: false };
        const diff = (o.side === "BUY" ? mkt - entry : entry - mkt);
        return { o, u: diff * cs * lot, hasPx: true };
      }).filter(x => x.hasPx);

      if (!scored.length) break;

      scored.sort((a, b) => a.u - b.u); // en kötü (en negatif) en başta
      const worst = scored[0];

      // Kapama: mevcut piyasa fiyatıyla
      const mkt = this.prices.getSpot(worst.o.instrument.key)!;
      await this.closeOneAtMarket(userId, worst.o.id, mkt);
    }
  }

  /** OrdersService._closeOrder ile %100 aynı muhasebe (negatif bakiye korumalı) */
  private async closeOneAtMarket(userId: string, orderId: string, closePx: number) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId, status: "OPEN" },
        include: { instrument: true },
      });
      if (!order) return;

      const cp = num(closePx);
      const dir = order.side === "BUY" ? 1 : -1;
      const entryPx = num(order.entryPrice);
      const pnl =
        (cp - entryPx) *
        num(order.instrument.contractSize, 1) *
        num(order.qtyLot) *
        dir;

      const margin = num(order.marginUsd);
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) return;

      // Negatif bakiye koruması (floor 0)
      const afterRelease = num(wallet.balance) + margin;
      const cappedPnl = Math.max(pnl, -afterRelease);
      const wasCapped = cappedPnl !== pnl;
      const afterPnl = afterRelease + cappedPnl;

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CLOSED",
          closePrice: String(cp),
          closedAt: new Date(),
          realizedPnlUsd: String(cappedPnl),
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: String(afterPnl) },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "MARGIN_RELEASE",
          amount: String(margin),
          balanceAfter: String(afterRelease),
          note: `Margin release (auto stop-out) for order ${order.id}`,
          orderId: order.id,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "REALIZED_PNL",
          amount: String(cappedPnl),
          balanceAfter: String(afterPnl),
          note: wasCapped
            ? `Realized PnL capped by NBP (from ${pnl.toFixed(2)})`
            : `Realized PnL (auto stop-out) for order ${order.id}`,
          orderId: order.id,
        },
      });
    });
  }
}
