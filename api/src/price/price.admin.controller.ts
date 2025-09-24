// src/price/price.admin.controller.ts
import {
  Body,
  Controller,
  Post,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Get,
  Query,
} from '@nestjs/common';
import { PriceService } from './price.service';
import { DriftBackToLiveDto, DriftToTargetDto } from './dto/admin.dto';
import { AdminApiKeyGuard } from '../common/admin-api-key.guard';
import { Public } from '../common/public.decorator';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';

const log = new Logger('PriceAdminController');

const toNum = (v: any, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
const mustNum = (name: string, v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException(`${name} must be a number`);
  return n;
};
const posNum = (name: string, v: any, def: number) => {
  const n = toNum(v, def);
  return n > 0 ? n : def;
};

// basit sınırlar (istediğin gibi ayarlayabilirsin)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

@Public()
@UseGuards(AdminApiKeyGuard)
@ApiTags('Admin/Prices')
@ApiSecurity('admin-key')
@Controller('/api/admin/prices')
export class PriceAdminController {
  constructor(private readonly prices: PriceService) {}

  @Post('drift-to-target')
  driftToTarget(@Body() dto: DriftToTargetDto) {
    try {
      if (!dto?.symbol) throw new BadRequestException('symbol required');

      const target = mustNum('target', dto.target);

      // varsayılan + sınırlar
      const intervalSec = clamp(posNum('intervalSec', dto.intervalSec ?? 10, 10), 1, 300);
      const tickSize = clamp(posNum('tickSize', dto.tickSize ?? 1, 1), 1e-8, 1_000_000);

      log.debug(
        `drift-to-target symbol=${dto.symbol} target=${target} intervalSec=${intervalSec} tickSize=${tickSize}`,
      );

      const st = this.prices.driftToTarget(dto.symbol, target, intervalSec, tickSize);
      return { ok: true, state: this.prices.publicView(st.symbol) };
    } catch (e: any) {
      log.error(`drift-to-target error: ${e?.message}`, e?.stack);
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('drift-to-target failed');
    }
  }

  @Post('drift-back-to-live')
  driftBack(@Body() dto: DriftBackToLiveDto) {
    try {
      if (!dto?.symbol) throw new BadRequestException('symbol required');

      const intervalSec = clamp(posNum('intervalSec', dto.intervalSec ?? 10, 10), 1, 300);
      const tickSize = clamp(posNum('tickSize', dto.tickSize ?? 1, 1), 1e-8, 1_000_000);

      log.debug(
        `drift-back-to-live symbol=${dto.symbol} intervalSec=${intervalSec} tickSize=${tickSize}`,
      );

      const st = this.prices.driftBackToLive(dto.symbol, intervalSec, tickSize);
      return { ok: true, state: this.prices.publicView(st.symbol) };
    } catch (e: any) {
      log.error(`drift-back-to-live error: ${e?.message}`, e?.stack);
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('drift-back-to-live failed');
    }
  }

  @Post('go-live-now')
  goLiveNow(@Body() dto: { symbol: string }) {
    try {
      if (!dto?.symbol) throw new BadRequestException('symbol required');

      log.debug(`go-live-now symbol=${dto.symbol}`);

      const st = this.prices.goLiveNow(dto.symbol);
      return { ok: true, state: this.prices.publicView(st.symbol) };
    } catch (e: any) {
      log.error(`go-live-now error: ${e?.message}`, e?.stack);
      throw new InternalServerErrorException('go-live-now failed');
    }
  }

  // ✅ KALDIRAÇ: Tek enstrüman için set/get
  @Post('leverage')
  setLeverage(@Body() dto: { symbol: string; leverage: number }) {
    try {
      if (!dto?.symbol) throw new BadRequestException('symbol required');
      const lev = mustNum('leverage', dto.leverage);
      const safe = Math.max(1, Math.floor(lev));

      const applied = this.prices.setLeverage(dto.symbol.trim().toUpperCase(), safe);
      log.debug(`leverage set symbol=${dto.symbol} leverage=${applied}`);

      return {
        ok: true,
        symbol: dto.symbol.trim().toUpperCase(),
        leverage: applied,
        state: this.prices.publicView(dto.symbol.trim().toUpperCase()),
      };
    } catch (e: any) {
      log.error(`leverage set error: ${e?.message}`, e?.stack);
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('leverage set failed');
    }
  }

  @Get('leverage')
  getLeverage(@Query('symbol') symbol?: string) {
    if (!symbol) throw new BadRequestException('symbol required');
    const sym = symbol.trim().toUpperCase();
    return {
      symbol: sym,
      leverage: this.prices.getLeverage(sym),
      state: this.prices.publicView(sym),
    };
    // not: sym yoksa state null dönebilir; bu durumda FE sembolü önce ensure edecek bir çağrı yapabilir
  }

  // ✅ KALDIRAÇ: Toplu set ([{symbol, leverage}, ...])
  @Post('leverage-bulk')
  setLeverageBulk(
    @Body()
    body: { items: Array<{ symbol: string; leverage: number }> },
  ) {
    try {
      if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
        throw new BadRequestException('items array required');
      }

      const results = body.items.map(({ symbol, leverage }) => {
        if (!symbol) throw new BadRequestException('symbol required in items');
        const sym = symbol.trim().toUpperCase();
        const lev = mustNum('leverage', leverage);
        const safe = Math.max(1, Math.floor(lev));
        const applied = this.prices.setLeverage(sym, safe);
        return {
          symbol: sym,
          leverage: applied,
          state: this.prices.publicView(sym),
        };
      });

      log.debug(`leverage-bulk updated=${results.length}`);
      return { ok: true, updated: results.length, results };
    } catch (e: any) {
      log.error(`leverage-bulk error: ${e?.message}`, e?.stack);
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('leverage-bulk failed');
    }
  }

  // Hızlı durum bakışı
  @Get('state')
  state(@Query('symbol') symbol?: string) {
    return symbol ? this.prices.publicView(symbol) : this.prices.publicViewAll();
  }
}
