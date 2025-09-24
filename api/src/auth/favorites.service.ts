// src/auth/favorites.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class FavoritesService {
  private readonly log = new Logger(FavoritesService.name);

  constructor(private prisma: PrismaService) {}

  private normalize(input: unknown): string[] {
    const arr = Array.isArray(input) ? input : [];
    const cleaned = Array.from(
      new Set(
        arr
          .map((s) => String(s ?? "").trim())
          .filter((s) => s && s.length <= 40)
      )
    );
    return cleaned.slice(0, 200);
  }

  async get(userId: string): Promise<string[]> {
    const fav = await this.prisma.favorite.findUnique({ where: { userId } });
    const raw = fav?.symbols as unknown as string[] | undefined;
    const out = this.normalize(raw);
    this.log.debug(`get user=${userId} count=${out.length}`);
    return out;
  }

  async set(userId: string, symbols: string[]) {
    const safe = this.normalize(symbols);
    this.log.debug(
      `set user=${userId} count=${safe.length} symbols=${JSON.stringify(safe)}`
    );
    const jsonArr = safe as unknown as Prisma.JsonValue[]; // ✅ Prisma v6 uyumu
    await this.prisma.favorite.upsert({
      where: { userId },
      create: { userId, symbols: jsonArr },
      update: { symbols: jsonArr },
    });
    return { ok: true, count: safe.length };
  }
}
