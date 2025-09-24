// src/orders/orders.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import {
  PrismaClient,
  OrderStatus,
  OrderSide,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PriceService } from "../price/price.service";

/* ========= Types ========= */
type CreateBody = {
  symbolKey?: string;
  instrumentKey?: string;

  side: "BUY" | "SELL";
  qtyLot: number;

  // BE fiyatı haricen gelmiyorsa bunlardan biri zorunlu
  entryPrice?: number;
  price?: number; // alias

  leverage?: number;
  tpPrice?: number | null;
  slPrice?: number | null;
};

type StatusFilter = "OPEN" | "CLOSED" | "CANCELED";

/* ========= Helpers ========= */
function num(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const s2 = (n: number) => round2(n).toFixed(2);

/* ========= Risk konfig ========= */
const STOP_OUT_LEVEL   = Number(process.env.STOP_OUT_LEVEL ?? 50);   // %
const MARGIN_CALL_LVL  = Number(process.env.MARGIN_CALL_LEVEL ?? 100); // % (şimdilik bilgilendirici)
const RISK_THROTTLE_MS = Number(process.env.RISK_THROTTLE_MS ?? 150);  // sembol başı throttle

/* ========= Core helpers (generic PrismaClient ile) ========= */
async function _createMarketOrder(
  prisma: PrismaClient,
  userId: string,
  body: CreateBody,
  idempotencyKey?: string,
) {
  const { side, qtyLot, leverage, entryPrice, price, tpPrice, slPrice } = body;

  const symKey = (body.symbolKey ?? body.instrumentKey)?.toUpperCase();
  if (!symKey) throw new BadRequestException("symbolKey is required");

  // Enstrüman
  const instrument = await prisma.instrument.findUnique({ where: { key: symKey } });
  if (!instrument || !instrument.isActive) throw new NotFoundException("INSTRUMENT_NOT_FOUND");

  // Fiyat zorunlu (PriceService entegre edilmediyse)
  const px = num(entryPrice ?? price);
  if (!px) throw new BadRequestException("PRICE_REQUIRED");

  // BUY/SELL için TP/SL mantık kontrolü
  if (tpPrice != null) {
    if (side === "BUY" && tpPrice <= px) {
      throw new BadRequestException("Take Profit seviyesi mevcut fiyattan daha yüksek olmalıdır.");
    }
    if (side === "SELL" && tpPrice >= px) {
      throw new BadRequestException("Take Profit seviyesi mevcut fiyattan daha düşük olmalıdır.");
    }
  }
  if (slPrice != null) {
    if (side === "BUY" && slPrice >= px) {
      throw new BadRequestException("Stop Loss seviyesi mevcut fiyattan daha düşük olmalıdır.");
    }
    if (side === "SELL" && slPrice <= px) {
      throw new BadRequestException("Stop Loss seviyesi mevcut fiyattan daha yüksek olmalıdır.");
    }
  }

  // Lot kontrolleri
  const lot = num(qtyLot);
  if (lot <= 0) throw new BadRequestException("INVALID_LOT");
  const lotStep = num(instrument.lotStep, 0.01);
  const minLot = num(instrument.minLot, 0.01);
  const stepOk = Math.abs(lot / lotStep - Math.round(lot / lotStep)) < 1e-8;
  if (!stepOk || lot < minLot) throw new BadRequestException("LOT_NOT_IN_STEP_OR_MIN");

  // Kaldıraç
  const lev = num(leverage ?? instrument.leverageMax, 0);
  if (lev <= 0) throw new BadRequestException("INVALID_LEVERAGE");

  // Marjin
  const contractSize = num(instrument.contractSize, 1);
  const margin = round2((px * contractSize * lot) / lev);

  // İdempotency: daha önce aynı key ile margin lock edilmiş mi?
  if (idempotencyKey) {
    const existingTxn = await prisma.transaction.findFirst({
      where: { idempotencyKey, type: "MARGIN_LOCK" },
      include: { order: { include: { instrument: true } } },
    });
    if (existingTxn?.order) {
      return { order: existingTxn.order, duplicated: true as const };
    }
  }

  // Tek transaction içinde: wallet + txn + order
  const result = await prisma.$transaction(async (tx) => {
    // Cüzdan
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException("WALLET_NOT_FOUND");

    const balance = num(wallet.balance);
    if (balance < margin) throw new BadRequestException("Yetersiz bakiye.");

    // Order
    const created = await tx.order.create({
      data: {
        userId,
        instrumentId: instrument.id,
        side: side as OrderSide,
        type: "MARKET",
        status: "OPEN",
        qtyLot: String(lot),
        leverageUsed: lev,
        entryPrice: String(px), // fiyat alanları string, para alanları 2 hane
        tpPrice: tpPrice != null ? String(tpPrice) : null,
        slPrice: slPrice != null ? String(slPrice) : null,
        marginUsd: s2(margin),
        openedAt: new Date(),
        meta: idempotencyKey ? { idem: idempotencyKey } : {},
      },
      include: { instrument: true },
    });

    // Wallet → margin lock
    const newBal = round2(balance - margin);
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: s2(newBal) },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "MARGIN_LOCK",
        amount: s2(-margin),
        balanceAfter: s2(newBal),
        note: `Margin lock for ${symKey} ${side} ${lot} lot @ ${px}`,
        orderId: created.id,
        idempotencyKey: idempotencyKey ?? null,
      },
    });

    return created;
  });

  return { order: result };
}

async function _closeOrder(
  prisma: PrismaClient,
  userId: string,
  orderId: string,
  closePrice?: number,
) {
  // Tek transaction
  const closed = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId, status: "OPEN" },
      include: { instrument: true },
    });
    if (!order) throw new NotFoundException("OPEN_ORDER_NOT_FOUND");

    const cp = num(closePrice ?? order.entryPrice);
    if (!cp) throw new BadRequestException("CLOSE_PRICE_REQUIRED");

    const dir = order.side === "BUY" ? 1 : -1;
    const entryPx = num(order.entryPrice);
    const pnl = round2(
      (cp - entryPx) *
      num(order.instrument.contractSize, 1) *
      num(order.qtyLot) *
      dir
    );

    const margin = num(order.marginUsd);

    // Cüzdan
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException("WALLET_NOT_FOUND");

    // Order kapat
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CLOSED",
        closePrice: String(cp),
        closedAt: new Date(),
        realizedPnlUsd: s2(pnl),
      },
      include: { instrument: true },
    });

    // Wallet hareketleri: margin release + realized pnl
    const afterRelease = round2(num(wallet.balance) + margin);
    const afterPnl = round2(afterRelease + pnl);

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: s2(afterPnl) },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "MARGIN_RELEASE",
        amount: s2(margin),
        balanceAfter: s2(afterRelease),
        note: `Margin release for order ${order.id}`,
        orderId: order.id,
      },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "REALIZED_PNL",
        amount: s2(pnl),
        balanceAfter: s2(afterPnl),
        note: `Realized PnL for order ${order.id}`,
        orderId: order.id,
      },
    });

    return updated;
  });

  return closed;
}

async function _listOrders(
  prisma: PrismaClient,
  userId: string,
  status?: StatusFilter,
) {
  return prisma.order.findMany({
    where: { userId, ...(status ? { status: status as OrderStatus } : {}) },
    orderBy: [{ openedAt: "desc" }],
    include: { instrument: true },
  });
}

/* ========= NestJS Service ========= */
@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  // Risk tetikleme için (PriceService AppModule tarafından enjekte edilecek)
  private priceService?: PriceService;

  // Sembol bazlı throttle & kullanıcı bazlı concurrency koruması
  private riskTimers = new Map<string, NodeJS.Timeout>();
  private riskUserLocks = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  /** AppModule → PriceService bağlamak için */
  setPriceService(ps: PriceService) {
    this.priceService = ps;
  }

  /** AppModule → price tick geldiğinde çağırır */
  onPriceTick(symbol: string, _price?: number) {
    // sembol bazlı throttle
    const t = this.riskTimers.get(symbol);
    if (t) clearTimeout(t);
    const h = setTimeout(() => {
      this.riskTimers.delete(symbol);
      this.runRiskForSymbol(symbol).catch((e) =>
        this.log.warn(`runRiskForSymbol(${symbol}) error: ${e?.message}`),
      );
    }, RISK_THROTTLE_MS);
    this.riskTimers.set(symbol, h);
  }

  /** Sembol özelinde tüm kullanıcılar için risk kontrolü */
  private async runRiskForSymbol(symbol: string) {
    // Bu sembolde açık emri olan kullanıcıları bul
    const orders = await this.prisma.order.findMany({
      where: { status: "OPEN", instrument: { key: symbol } },
      select: { userId: true },
      distinct: ["userId"],
    });
    if (!orders.length) return;

    for (const { userId } of orders) {
      await this.runRiskForUser(userId);
    }
  }

  /** Kullanıcı bazında stop-out akışı (gerçek borsa davranışı) */
  private async runRiskForUser(userId: string) {
    if (this.riskUserLocks.has(userId)) return;
    this.riskUserLocks.add(userId);
    try {
      // Döngü: Stop-out seviyesine çıkana kadar en kötü pozisyonu kapat
      // (worst-first liquidation)
      // Not: Her kapanıştan sonra metrikleri tazeleyerek devam ediyoruz.
      while (true) {
        // Açık emirler + cüzdan
        const [wallet, openOrders] = await Promise.all([
          this.prisma.wallet.findUnique({ where: { userId } }),
          this.prisma.order.findMany({
            where: { userId, status: "OPEN" },
            include: { instrument: true },
          }),
        ]);

        const balance = num(wallet?.balance);
        const usedMargin = round2(
          openOrders.reduce((s, o) => s + num(o.marginUsd), 0),
        );

        if (usedMargin <= 0) break; // pozisyon yok → risk bitti

        // İlgili sembollerin fiyatlarını al
        const keys = Array.from(new Set(openOrders.map((o) => o.instrument.key)));
        const priceMap = new Map<string, number>();
        if (this.priceService) {
          const m = this.priceService.getPrices(keys);
          m.forEach((v, k) => priceMap.set(k, v));
        }
        // Fiyat yoksa entry fallback (çok nadir)
        for (const k of keys) {
          if (!priceMap.has(k)) {
            const anyOrder = openOrders.find((o) => o.instrument.key === k);
            if (anyOrder) priceMap.set(k, num(anyOrder.entryPrice));
          }
        }

        // Unrealized PnL
        const upnlPerOrder = openOrders.map((o) => {
          const px = priceMap.get(o.instrument.key) ?? num(o.entryPrice);
          const dir = o.side === "BUY" ? 1 : -1;
          const pnl = (px - num(o.entryPrice)) * num(o.instrument.contractSize, 1) * num(o.qtyLot) * dir;
          return { id: o.id, symbol: o.instrument.key, pnl: round2(pnl), price: px, margin: num(o.marginUsd) };
        });
        const totalUpnl = round2(upnlPerOrder.reduce((s, x) => s + x.pnl, 0));

        // Equity ve Margin Level
        const equity = round2(balance + totalUpnl);
        const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : Infinity;

        // Margin Call seviyesi altındaysa logla (şimdilik bilgilendirme)
        if (marginLevel < MARGIN_CALL_LVL) {
          this.log.debug(`MARGIN CALL user=${userId} ML=${marginLevel.toFixed(2)}%`);
        }

        // Stop-out seviyesi üzerindeyse çık
        if (marginLevel >= STOP_OUT_LEVEL) break;

        // En kötü (en negatif) PnL'li emri bul
        const worst = upnlPerOrder.reduce((min, x) => (x.pnl < min.pnl ? x : min), upnlPerOrder[0]);
        if (!worst) break;

        // Emri mevcut piyasadan kapat
        await _closeOrder(this.prisma, userId, worst.id, worst.price);

        // Döngü: tekrar ölç, gerekirse başka emir kapat
      }
    } catch (e: any) {
      this.log.warn(`runRiskForUser(${userId}) error: ${e?.message}`);
    } finally {
      this.riskUserLocks.delete(userId);
    }
  }

  /* ========= Public API ========= */

  openOrder(userId: string, body: CreateBody, idempotencyKey?: string) {
    return _createMarketOrder(this.prisma, userId, body, idempotencyKey);
  }

  createMarketOrder(userId: string, body: CreateBody, idempotencyKey?: string) {
    return _createMarketOrder(this.prisma, userId, body, idempotencyKey);
  }

  closeOrder(userId: string, orderId: string, closePrice?: number) {
    return _closeOrder(this.prisma, userId, orderId, closePrice);
  }

  listOrders(userId: string, status?: StatusFilter) {
    return _listOrders(this.prisma, userId, status);
  }
}

/* ========= Standalone exports (routes.ts için) ========= */
const _standalone = new PrismaClient();

export function createMarketOrder(userId: string, body: CreateBody, idempotencyKey?: string) {
  return _createMarketOrder(_standalone, userId, body, idempotencyKey);
}

export function closeOrder(userId: string, orderId: string, closePrice?: number) {
  return _closeOrder(_standalone, userId, orderId, closePrice);
}

export function listOrders(userId: string, status?: StatusFilter) {
  return _listOrders(_standalone, userId, status);
}
