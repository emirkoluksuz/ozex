/* Enstrüman kuralları — şimdilik koddan. İleride DB tablosuna taşıyabilirsin. */
export function getContractSize(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("XAUUSD")) return 100;       // 1 lot = 100 oz
  if (/^[A-Z]{6}$/.test(s)) return 100_000;   // EURUSD/FX
  if (s.includes("BTC")) return 5;            // BTC futures benzeri
  return 1;
}

export function getMaxLeverage(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("XAUUSD")) return 400;
  if (/^[A-Z]{6}$/.test(s)) return 400;
  if (s.includes("BTC")) return 100;          // kriptoda daha düşük örnek
  return 100;
}

export function getTickSize(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("XAUUSD")) return 0.01;
  if (/^[A-Z]{6}$/.test(s)) return 0.0001;    // FX
  if (s.includes("BTC")) return 0.01;
  return 0.01;
}

export function isTickAligned(price: number, tick: number): boolean {
  if (tick <= 0) return true;
  const eps = tick / 10;
  const r = Math.abs(Math.round(price / tick) * tick - price);
  return r < eps;
}
