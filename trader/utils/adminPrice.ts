// frontend/utils/adminPrice.ts
import { http } from '@/lib/http';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const toNum = (v: any, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

/** Hedef fiyata doğru sürükle */
export async function driftToTarget(
  symbol: string,
  target: number,
  intervalSec = 10,
  tickSize = 1,
) {
  const body = {
    symbol,
    target: toNum(target, NaN), // NaN ise BE validasyon hatası döner
    intervalSec: toNum(intervalSec, 10),
    tickSize: toNum(tickSize, 1),
  };
  const { data } = await http.post('/api/admin/prices/drift-to-target', body, {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  });
  return data;
}

/** Canlı fiyata geri dön (kademeli) */
export async function driftBackToLive(symbol: string, intervalSec = 10, tickSize = 1) {
  const body = {
    symbol,
    intervalSec: toNum(intervalSec, 10),
    tickSize: toNum(tickSize, 1),
  };
  const { data } = await http.post('/api/admin/prices/drift-back-to-live', body, {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  });
  return data;
}

/** Anında LIVE moda al */
export async function goLiveNow(symbol: string) {
  const { data } = await http.post(
    '/api/admin/prices/go-live-now',
    { symbol },
    { headers: { 'X-Admin-Key': ADMIN_KEY } },
  );
  return data;
}

/** Tek enstrüman için kaldıraç ayarla (ör. 400 => 1:400) */
export async function setLeverage(symbol: string, leverage: number) {
  const body = { symbol, leverage: Number(leverage) };
  const { data } = await http.post('/api/admin/prices/leverage', body, {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  });
  return data;
}

/** Tek enstrüman için mevcut kaldıraç değerini getir */
export async function getLeverage(symbol: string) {
  const { data } = await http.get('/api/admin/prices/leverage', {
    params: { symbol },
    headers: { 'X-Admin-Key': ADMIN_KEY },
  });
  return data;
}

/** Toplu kaldıraç ayarlama */
export async function setLeverageBulk(items: Array<{ symbol: string; leverage: number }>) {
  const body = { items };
  const { data } = await http.post('/api/admin/prices/leverage-bulk', body, {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  });
  return data;
}
