// src/orders/orders.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";

type Side = "BUY" | "SELL";
type Type = "MARKET" | "LIMIT" | "STOP";

type OpenDto = {
  symbolKey?: string;     // örn: "BTCUSDT", "BTC/USDT", "XAUUSD"
  instrumentKey?: string; // alternatif ad
  side: Side;             // BUY | SELL
  type?: Type;            // default MARKET (şema), servise aktarılmıyor
  qtyLot: number;         // lot
  tpPrice?: number;
  slPrice?: number;
  // BE fiyat doğrulaması için
  entryPrice?: number;
  price?: number;         // alias
};

type CloseDto = { price?: number };

function pickUserId(req: any): string {
  return req?.user?.id || req?.user?.userId || req?.user?.sub;
}

// "BTC/USDT" | "btc-usdt" | "btc_usdt" → "BTCUSDT"
function normKey(s?: string) {
  return (s ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// ISO → kısa metin
function fmt(ts?: Date | string | null) {
  if (!ts) return undefined;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

@Controller("/api/orders")
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post()
  async open(@Req() req: any, @Body() dto: OpenDto) {
    const userId = pickUserId(req);
    if (!userId) throw new UnauthorizedException("USER_NOT_RESOLVED");

    const rawKey = dto.symbolKey ?? dto.instrumentKey;
    const symbolKey = normKey(rawKey);
    if (!symbolKey) throw new BadRequestException("symbolKey is required");
    if (!Number.isFinite(dto.qtyLot) || dto.qtyLot <= 0) {
      throw new BadRequestException("qtyLot must be > 0");
    }

    // Idempotency-Key (çift tıklama koruması)
    const headers = req?.headers ?? {};
    const idem: string | undefined =
      headers["x-idempotency-key"] ||
      headers["idempotency-key"] ||
      undefined;

    const result = await this.svc.openOrder(
      userId,
      {
        symbolKey,
        side: dto.side,
        qtyLot: dto.qtyLot,
        tpPrice: dto.tpPrice,
        slPrice: dto.slPrice,
        entryPrice: dto.entryPrice ?? dto.price,
      },
      idem,
    );

    const order = (result as any).order ?? result;
    return {
      ok: true,
      duplicated: Boolean((result as any).duplicated),
      order: {
        ...order,
        openedAtText: fmt(order.openedAt),
        closedAtText: fmt(order.closedAt),
      },
    };
  }

  @Post(":id/close")
  async close(@Req() req: any, @Param("id") id: string, @Body() body: CloseDto) {
    const userId = pickUserId(req);
    if (!userId) throw new UnauthorizedException("USER_NOT_RESOLVED");

    const closed = await this.svc.closeOrder(userId, id, body?.price);
    return {
      ok: true,
      order: {
        ...closed,
        openedAtText: fmt(closed.openedAt),
        closedAtText: fmt(closed.closedAt),
      },
    };
  }

  @Get()
  async list(@Req() req: any, @Query("status") status?: string) {
    const userId = pickUserId(req);
    if (!userId) throw new UnauthorizedException("USER_NOT_RESOLVED");

    const s = typeof status === "string" ? status.toUpperCase() : undefined;
    const ok =
      s === "OPEN" || s === "CLOSED" || s === "CANCELED" ? (s as any) : undefined;

    const rows = await this.svc.listOrders(userId, ok);
    return {
      orders: rows.map((o) => ({
        ...o,
        openedAtText: fmt(o.openedAt),
        closedAtText: fmt(o.closedAt),
      })),
    };
  }
}
