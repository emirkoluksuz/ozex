export type PriceMode = 'LIVE' | 'TO_TARGET' | 'AT_TARGET_FOLLOW' | 'TO_LIVE';

export type SymbolState = {
  symbol: string;
  tickSize: number;
  intervalSec: number;
  mode: PriceMode;
  current: number;
  lastLive: number;
  target: number | null;
  timer: NodeJS.Timeout | null;
  followLiveFrom: number | null;

  // mevcut sistem
  prevClose?: number | null;   // dünkü kapanış
  changeDaily?: number;        // yüzde değişim (PriceService hesaplıyor)

  // İstersen ileride kullanmak üzere bırak; ama opsiyonel kalsın:
  dailyRef?: number | null;
  dailyRefDay?: number | null; // YYYYMMDD (UTC)
  change24h?: number;          // alias olarak kullanabilirsin

  // yeni: enstrüman bazlı kaldıraç (ör. 400 => 1:400)
  leverage?: number;
};
