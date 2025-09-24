// src/price/price.service.ts
import { BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SymbolState } from './price.types';

function toPosNumber(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function ensureFinite(name: string, v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException(`${name} must be a number`);
  return n;
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ✅ public tarafa leverage da çıkacak
type PublicSymbolState = Omit<SymbolState, 'timer' | 'followLiveFrom'> & {
  changeDaily?: number; // dünkü kapanışa göre %
  prevClose?: number;   // (opsiyonel) debug/izleme için
};

const DEFAULT_LEVERAGE = Number(process.env.DEFAULT_LEVERAGE ?? 400) || 400;

@Injectable()
export class PriceService implements OnModuleDestroy {
  private readonly log = new Logger(PriceService.name);
  private states = new Map<string, SymbolState>();
  private listeners = new Set<(s: SymbolState) => void>();

  // Dünkü kapanış ve günü izlemek için
  private prevClose = new Map<string, number>();                    // symbol -> dünkü kapanış
  private lastTick = new Map<string, { day: string; p: number }>(); // symbol -> son tick (UTC gün)

  // ✅ Enstrüman bazlı kaldıraç yönetimi
  private leverageMap = new Map<string, number>(); // symbol -> leverage

  /** Kaldıraç getter/setter (admin controller buradan kullanacak) */
  getLeverage(symbol: string) {
    return this.leverageMap.get(symbol) ?? DEFAULT_LEVERAGE;
  }
  setLeverage(symbol: string, leverage: number) {
    const v = Math.max(1, Math.floor(Number(leverage) || DEFAULT_LEVERAGE));
    this.leverageMap.set(symbol, v);
    const st = this.states.get(symbol);
    if (st) {
      (st as any).leverage = v;
      this.emit(st);
    }
    return v;
  }

  /** Internal → Public view mapper */
  private toPublic(st?: SymbolState | null): PublicSymbolState | null {
    if (!st) return null;
    const { timer, followLiveFrom, ...rest } = st as any;
    // ✅ leverage alanını garanti altına al
    if (rest && (rest as any).symbol) {
      rest.leverage = this.getLeverage((rest as any).symbol);
    }
    return rest as PublicSymbolState;
  }
  publicView(symbol: string): PublicSymbolState | null {
    return this.toPublic(this.states.get(symbol));
  }
  publicViewAll(): PublicSymbolState[] {
    return Array.from(this.states.values()).map((s) => this.toPublic(s)!);
  }

  /** Tek sembol anlık fiyatı (alias: getSpot ile aynı davranır) */
  getPrice(symbol: string): number | null {
    return this.states.get(symbol)?.current ?? null;
  }
  /** Birden fazla sembolün anlık fiyatı */
  getPrices(symbols: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of symbols) {
      const v = this.states.get(s)?.current;
      if (typeof v === 'number') m.set(s, v);
    }
    return m;
  }

  /** Risk servisi ile uyum için: mevcut spot fiyatı döndürür. */
  getSpot(symbol: string): number | null {
    return this.getPrice(symbol);
  }

  /**
   * Risk controller gibi imperatif güncellemeler için spotu zorla ayarlar.
   * Modu LIVE'a çeker, günlük değişimi yeniden hesaplar ve yayınlar.
   */
  setSpot(symbol: string, price: number): number {
    const p = Number(price);
    if (!Number.isFinite(p)) throw new BadRequestException('price must be a finite number');

    const st = this.ensure(symbol, p);
    const dayUtc = new Date().toISOString().slice(0, 10);

    // "son tick" kaydını da güncelle (gün değişimi takibi için)
    this.lastTick.set(symbol, { day: dayUtc, p });

    // Anlık spotu zorla
    st.lastLive = p;
    st.current = p;
    st.mode = 'LIVE';
    st.target = null;
    st.followLiveFrom = null;

    this.recomputeDailyChange(st);
    this.emit(st);
    return st.current;
  }

  ensure(symbol: string, initialPrice = 100, tickSize = 1, intervalSec = 10): SymbolState {
    const ex = this.states.get(symbol);
    if (ex) return ex;
    const st: SymbolState = {
      symbol,
      tickSize,
      intervalSec,
      mode: 'LIVE',
      current: initialPrice,
      lastLive: initialPrice,
      target: null,
      timer: null,
      followLiveFrom: null,
      // ✅ ilk kurulumda kaldıraç ata
      leverage: this.getLeverage(symbol),
    } as any;
    this.states.set(symbol, st);
    return st;
  }

  onChange(cb: (s: SymbolState) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private emit(s: SymbolState) {
    this.listeners.forEach((cb) => {
      try {
        cb(s);
      } catch (e: any) {
        this.log.warn(`listener error for ${s.symbol}: ${e?.message}`);
      }
    });
  }

  /** Opsiyonel: adapter dünkü kapanışı verirse referansı set et */
  setPrevClose(symbol: string, close: number) {
    if (!Number.isFinite(close) || close <= 0) return; // ⬅️ ek koruma
    this.prevClose.set(symbol, close);
    const st = this.ensure(symbol);
    // mevcut current’a göre % güncelle
    this.recomputeDailyChange(st);
    this.emit(st);
  }

  /** % hesaplamasını tek yerden yap */
  private recomputeDailyChange(st: SymbolState) {
    const pc = this.prevClose.get(st.symbol);
    if (typeof pc === 'number' && pc !== 0) {
      (st as any).changeDaily = ((st.current - pc) / pc) * 100;
      (st as any).prevClose = pc;
    } else {
      (st as any).changeDaily = 0;
      (st as any).prevClose = pc;
    }
  }

  /** Canlı kaynaktan fiyat — dünkü kapanışı ve %’yi burada çıkarıyoruz */
  pushLive(symbol: string, price: number) {
    const st = this.ensure(symbol, price);
    const dayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

    // Gün değişimini yakala → DÜNKÜ KAPANIŞ = önceki günün SON tick’i
    const prev = this.lastTick.get(symbol);
    if (prev && prev.day !== dayUtc) {
      this.prevClose.set(symbol, prev.p);
    }
    // Son tick’i güncelle
    this.lastTick.set(symbol, { day: dayUtc, p: price });

    // Durum güncelle
    st.lastLive = price;
    if (st.mode === 'LIVE') {
      st.current = price;
    }

    // %’yi güncelle
    this.recomputeDailyChange(st);
    this.emit(st);
  }

  /** Admin: hedefe yürü (hedefe varınca AT_TARGET_FOLLOW’ta kal) */
  driftToTarget(symbol: string, target: number, intervalSec = 10, tickSize = 1) {
    if (!symbol) throw new BadRequestException('symbol required');
    const safeTarget = ensureFinite('target', target);
    const st = this.ensure(symbol);
    st.intervalSec = clamp(toPosNumber(intervalSec, 10), 1, 300);        // ⬅️ clamp
    st.tickSize = clamp(toPosNumber(tickSize, 1), 1e-8, 1_000_000);      // ⬅️ clamp
    st.mode = 'TO_TARGET';
    st.target = safeTarget;
    st.followLiveFrom = null;
    this.startStepper(st);
    return st;
  }

  /** Admin: canlıya dön */
  driftBackToLive(symbol: string, intervalSec = 10, tickSize = 1) {
    if (!symbol) throw new BadRequestException('symbol required');
    const st = this.ensure(symbol);
    st.intervalSec = clamp(toPosNumber(intervalSec, 10), 1, 300);        // ⬅️ clamp
    st.tickSize = clamp(toPosNumber(tickSize, 1), 1e-8, 1_000_000);      // ⬅️ clamp
    st.mode = 'TO_LIVE';
    st.target = st.lastLive;
    st.followLiveFrom = null;
    this.startStepper(st);
    return st;
  }

  /** Admin: anında LIVE */
  goLiveNow(symbol: string) {
    if (!symbol) throw new BadRequestException('symbol required');
    const st = this.ensure(symbol);
    st.mode = 'LIVE';
    st.target = null;
    st.followLiveFrom = null;
    this.stopStepper(st);
    st.current = st.lastLive;
    this.recomputeDailyChange(st);
    this.emit(st);
    return st;
  }

  private startStepper(st: SymbolState) {
    this.stopStepper(st);
    const ms = Math.max(1, Math.floor(st.intervalSec * 1000));
    st.timer = setInterval(() => this.step(st), ms);
    this.step(st);
  }
  private stopStepper(st: SymbolState) {
    if (st.timer) {
      clearInterval(st.timer);
      st.timer = null;
    }
  }

  private step(st: SymbolState) {
    if (st.mode === 'TO_TARGET' && typeof st.target === 'number') {
      const dir = Math.sign(st.target - st.current);
      if (dir === 0) {
        st.mode = 'AT_TARGET_FOLLOW';
        st.followLiveFrom = st.lastLive;
        this.recomputeDailyChange(st);
        this.emit(st);
        return;
      }
      const next = st.current + dir * st.tickSize;
      st.current =
        (dir > 0 && next > st.target) || (dir < 0 && next < st.target) ? st.target : next;
      this.recomputeDailyChange(st);
      this.emit(st);
      return;
    }

    if (st.mode === 'AT_TARGET_FOLLOW') {
      const base = typeof st.followLiveFrom === 'number' ? st.followLiveFrom : st.lastLive;
      const liveDelta = st.lastLive - base;
      const dir = Math.sign(liveDelta);
      if (dir !== 0) st.current = st.current + dir * st.tickSize;
      st.followLiveFrom = st.lastLive;
      this.recomputeDailyChange(st);
      this.emit(st);
      return;
    }

    if (st.mode === 'TO_LIVE') {
      if (typeof st.target !== 'number') st.target = st.lastLive;
      const dir = Math.sign((st.target as number) - st.current);
      if (dir === 0) {
        st.mode = 'LIVE';
        st.target = null;
        st.followLiveFrom = null;
        this.stopStepper(st);
        this.recomputeDailyChange(st);
        this.emit(st);
        return;
      }
      const next = st.current + dir * st.tickSize;
      st.current =
        (dir > 0 && next > (st.target as number)) || (dir < 0 && next < (st.target as number))
          ? (st.target as number)
          : next;
      this.recomputeDailyChange(st);
      this.emit(st);
      return;
    }
  }

  onModuleDestroy() {
    this.states.forEach((s) => this.stopStepper(s));
  }
}
