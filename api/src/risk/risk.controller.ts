import { Body, Controller, Post } from "@nestjs/common";
import { PriceService } from "../price/price.service";
import { RiskService } from "./risk.service";

@Controller("risk")
export class RiskController {
  constructor(private prices: PriceService, private risk: RiskService) {}

  // Python yayınından veya admin panelinden besleme:
  // { instrumentKey: "XAUUSD", price: 2334.56 }
  @Post("tick")
  async tick(@Body() b: { instrumentKey: string; price: number; userId?: string }) {
    this.prices.setSpot(b.instrumentKey, Number(b.price));
    // (Opsiyonel) belirli bir kullanıcıda tekrar hesap
    if (b.userId) await this.risk.ensureStopOut(String(b.userId));
    return { ok: true };
  }

  // Manuel (ya da CRON/worker) tetik: { userId: "..." } veya boş → tüm açık emri olan kullanıcılar
  @Post("recalc")
  async recalc(@Body() b?: { userId?: string }) {
    if (b?.userId) {
      await this.risk.ensureStopOut(String(b.userId));
      return { ok: true };
    }
    // tüm açık emri olan kullanıcıları tara
    const userIds = await (this as any).getUsersWithOpen(); // helper aşağıda
    for (const uid of userIds) await this.risk.ensureStopOut(uid);
    return { ok: true, users: userIds.length };
  }

  // küçük helper (aynı dosyada, prisma’ya direkt erişmeden):
  private async getUsersWithOpen(): Promise<string[]> {
    // “hack”: RiskService üzerinden prisma’ya erişelim
    const prisma = (this.risk as any).prisma as import("../prisma/prisma.service").PrismaService;
    const rows = await prisma.order.findMany({
      where: { status: "OPEN" },
      select: { userId: true },
      distinct: ["userId"],
    });
    return rows.map(r => r.userId);
  }
}
