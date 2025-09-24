// src/price/price.public.controller.ts
import { Controller, Get, Param, Header, NotFoundException } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { PriceService } from './price.service';

function normalizeSymbolParam(raw: string): string {
  // BTC%2FUSDT, btc/usdt,  btc%2fusdt  ->  BTC/USDT
  const decoded = decodeURIComponent(String(raw || ''));
  return decoded.trim().toUpperCase();
}

// İç temsili tekilleştirip dışarıya sabit şema ile veren küçük yardımcı
function toPublicRow(st: any) {
  return {
    ...st,
    // changeDaily veya change24h hangisi varsa onu kullan; ikisi de yoksa 0
    change24h: Number.isFinite(st?.change24h)
      ? st.change24h
      : Number.isFinite(st?.changeDaily)
      ? st.changeDaily
      : 0,
    // debug/izleme için dünkü kapanış varsa geçir
    ...(Number.isFinite(st?.prevClose) ? { prevClose: st.prevClose } : {}),
    // ✅ leverage her zaman dönsün; yoksa 400
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
    const symbol = normalizeSymbolParam(symbolParam);
    const st = this.prices.publicView(symbol);
    if (!st) {
      throw new NotFoundException(`Symbol not found: ${symbol}`);
    }
    return toPublicRow(st);
  }
}
