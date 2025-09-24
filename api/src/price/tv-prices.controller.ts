// src/price/tv-prices.controller.ts
import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { PriceService } from './price.service';
import { Public } from '../common/public.decorator'; // <-- ekle

type TVRow = { symbol: string; last: number; change24h?: number | null };

@Public() // <-- ekle
@Controller('/api/internal/tv')
export class TvPricesController {
  constructor(private readonly prices: PriceService) {}

  @Post('prices')
  @HttpCode(204)
  async ingest(@Body() body: { symbols: TVRow[] }) {
    for (const r of body.symbols ?? []) {
      if (!r?.symbol || r.last == null) continue;

      const last = Number(r.last);
      this.prices.pushLive(r.symbol, last);

      const pct = r.change24h;
      if (typeof pct === 'number' && Number.isFinite(pct)) {
        const prevClose = last / (1 + pct / 100);
        this.prices.setPrevClose(r.symbol, prevClose);
      }
    }
  }
}
