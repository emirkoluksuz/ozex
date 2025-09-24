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
type Type = "MARKET" | "LIMIT" | "STOP"; // şimdilik servise göndermiyoruz

type OpenDto = {
  symbolKey?: string;     // örn: "BTCUSDT", "XAUUSD"
  instrumentKey?: string; // alternatif ad
  side: Side;             // BUY | SELL
  type?: Type;            // default MARKET (şema), servise aktarılmıyor
  qtyLot: number;         // lot
  tpPrice?: number;
  slPrice?: number;

  // ⬇️ BE fiyat doğrulaması için ekledik
  entryPrice?: number;
  price?: number;         // alias
};

type CloseDto = { price?: number };

function pickUserId(req: any): string {
  return req?.user?.id || req?.user?.userId || req?.user?.sub;
}

// ufak bir tarih formatlayıcı (ISO'yu kısa metne çevirir)
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

@Controller("orders")
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post()
  async open(@Req() req: any, @Body() dto: OpenDto) {
    const userId = pickUserId(req);
    if (!userId) throw new UnauthorizedException("USER_NOT_RESOLVED");

    const symbolKey = dto.symbolKey ?? dto.instrumentKey;
    if (!symbolKey) throw new BadRequestException("symbolKey is required");
    if (!Number.isFinite(dto.qtyLot) || dto.qtyLot <= 0) {
      throw new BadRequestException("qtyLot must be > 0");
    }

    // Idempotency-Key (çift tıklama koruması)
    const idem =
      (req.headers["x-idempotency-key"] as string) ||
      (req.headers["idempotency-key"] as string) ||
      (req.headers["idempotency-key"] as string) || // Node header’ları lowercase gelir; emniyet için bıraktık
      undefined;

    const result = await this.svc.openOrder(
      userId,
      {
        symbolKey,
        side: dto.side,
        qtyLot: dto.qtyLot,
        tpPrice: dto.tpPrice,
        slPrice: dto.slPrice,
        // ⬇️ BE’nin PRICE_REQUIRED koşulu için fiyatı geçiriyoruz
        entryPrice: dto.entryPrice ?? dto.price,
      },
      idem,
    );

    // service { order } veya { order, duplicated } döndürüyor
    const order = (result as any).order ?? result;

    // UI bekleyen forma yakın ufak zenginleştirme
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
    // Frontend OrdersGrid/HistoryGrid res?.orders?.map(...) bekliyor → { orders: [...] } döndürüyoruz
    return {
      orders: rows.map((o) => ({
        ...o,
        openedAtText: fmt(o.openedAt),
        closedAtText: fmt(o.closedAt),
      })),
    };
  }
}
