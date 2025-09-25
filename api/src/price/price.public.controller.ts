// src/price/price.public.controller.ts
import { Controller, Get, Param, Header, NotFoundException } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { PriceService } from './price.service';

// "BTC%2FUSDT", "btc/usdt" → display: "BTC/USDT", lookup: "BTCUSDT"
function normalizeSymbolParam(raw: string): { display: string; lookup: string } {
  const decoded = decodeURIComponent(String(raw || '')).trim().toUpperCase();
  const lookup = decoded.replace(/[^A-Z0-9]/g, ''); // ayraçları kaldır
  return { display: decoded, lookup };
}

// İç temsili tekilleştirip dışarıya sabit şema ile veren küçük yardımcı
function toPublicRow(st: any) {
  return {
    ...st,
    change24h: Number.isFinite(st?.change24h)
      ? st.change24h
      : Number.isFinite(st?.changeDaily)
      ? st.changeDaily
      : 0,
    ...(Number.isFinite(st?.prevClose) ? { prevClose: st.prevClose } : {}),
    leverage: Number.isFinite(st?.leverage) ? st.leverage : 400,
  };
}

@Public()
@Controller('/api/prices')
export class PricePublicController {
  constructor(private readonly prices: PriceService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  all() {
    return this.prices.publicViewAll().map((s) => toPublicRow(s));
  }

  @Get(':symbol')
  @Header('Cache-Control', 'no-store')
  one(@Param('symbol') symbolParam: string) {
    const { display, lookup } = normalizeSymbolParam(symbolParam);
    const st = this.prices.publicView(lookup);
    if (!st) {
      throw new NotFoundException(`Symbol not found: ${display}`);
    }
    return toPublicRow(st);
  }
}
