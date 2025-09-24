// /components/MarketList.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MarketRow, { Market } from "./MarketRow";
import { Search, Star } from "lucide-react";
import { usePrices } from "@/hooks/usePrices";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserKey } from "@/hooks/useUserKey";
import { fetchFavorites, saveFavorites } from "@/utils/userApi";
import { debounce } from "@/utils/debounce";

const categories = ["★", "Tümü", "Forex", "Kripto", "Hisse", "Emtia", "Endeks"];

// Kürasyon tablosu (6 enstrüman)
const INSTRUMENTS: Array<{
  key: string;
  display: string;
  category: "Forex" | "Kripto" | "Hisse" | "Emtia" | "Endeks";
}> = [
  { key: "BTCUSDT", display: "BTC/USDT",  category: "Kripto" },
  { key: "XAUUSD",  display: "XAU/USD",   category: "Emtia"  },
  { key: "EURUSD",  display: "EUR/USD",   category: "Forex"  },
  { key: "XU100",   display: "BIST100",   category: "Endeks" },
  { key: "THYAO",   display: "THYAO/TRY", category: "Hisse"  },
  { key: "AAPL",    display: "AAPL/USD",  category: "Hisse"  },
];

/** Canlı fiyat satırı (usePrices çıktısında beklenenler) */
type PriceRow = {
  symbol?: string;
  price?: number;
  change24h?: number;
  changeDaily?: number;
};

type PricesMap = Record<string, PriceRow>;

// Gerekli bazı aliaslar
const ALIASES: Record<string, string[]> = {
  BTCUSDT: ["BTCUSD", "BTC/USDT", "BTC/USD"],
  XU100: ["BIST100"],
  THYAO: ["THYAO/TRY", "THYAOUSD", "THYAO"],
  AAPL: ["AAPLUSD", "AAPL/USD", "AAPL"],
};

// -----------------------
// Format yardımcıları
// -----------------------
const nf2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function fmt2(n: number) {
  return nf2.format(Number(n.toFixed(2)));
}
const noSlash = (s: string) => s.replace(/\//g, "");
const withSlashUSD = (s: string) =>
  s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;

/** prices map’inde en uygun canlı kaydı bul (eşleşen BE key’i de döndür) */
function pickLive(
  prices: PricesMap,
  curKey: string,
  display: string,
): { matchedKey: string; price: number; change: number } | null {
  const candidates: string[] = [];

  // 1) Kürasyon key’i
  candidates.push(curKey);

  // 2) Display varyantları
  candidates.push(noSlash(display));
  candidates.push(withSlashUSD(curKey));

  // 3) USD/USDT varyantları
  if (curKey.endsWith("USDT")) candidates.push(curKey.replace(/USDT$/, "USD"));
  if (curKey.endsWith("USD"))  candidates.push(curKey.replace(/USD$/, "USDT"));
  if (display.includes("/USDT")) candidates.push(display.replace("/USDT", "/USD"));
  if (display.includes("/USD"))  candidates.push(display.replace("/USD", "/USDT"));

  // 4) Alias tablosu
  if (ALIASES[curKey]) candidates.push(...ALIASES[curKey]);

  // 5) Slash'lı/slash'sız tüm varyantları ekle
  const extra: string[] = [];
  for (const c of [...candidates]) {
    extra.push(noSlash(c));
    extra.push(withSlashUSD(noSlash(c)));
  }
  candidates.push(...extra);

  // 6) Deneme
  const tried = new Set<string>();
  for (const c of candidates) {
    const k = String(c).toUpperCase();
    if (tried.has(k)) continue;
    tried.add(k);

    const row: PriceRow | undefined =
      prices[k] ||
      prices[k.replace(/\//g, "")] ||
      prices[withSlashUSD(k)];

    if (row && typeof row.price === "number" && Number.isFinite(row.price)) {
      const change =
        typeof row.change24h === "number" && Number.isFinite(row.change24h)
          ? row.change24h
          : typeof row.changeDaily === "number" && Number.isFinite(row.changeDaily)
          ? row.changeDaily
          : 0;
      const matchedKey = (row.symbol ?? k).toUpperCase();
      return { matchedKey, price: row.price, change };
    }
  }
  return null;
}

export default function MarketList({
  selectedSymbol,
  onSelectSymbol,
}: {
  selectedSymbol?: string;
  onSelectSymbol?: (
    displaySymbol: string,
    backendKey?: string,
    initialPrice?: number,
    initialChangePct?: number,
  ) => void;
}) {
  const [active, setActive] = useState<(typeof categories)[number]>("Tümü");
  const [query, setQuery] = useState("");

  // Kullanıcıya özel namespace
  const userKey = useUserKey();
  const [favorites, setFavorites] = useLocalStorage<string[]>(
    `ml_fav_v1:${userKey}`,
    [],
  );

  // Canlı fiyatlar (HTTP snapshot + WS)
  const { prices } = usePrices();
  // 🔧 ESlint: ensure stable dependency for useMemo below
  const pricesMap = useMemo(() => (prices ?? {}) as PricesMap, [prices]);

  // İlk sync: server → local
  const syncingRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userKey || userKey === "anon") return;
      syncingRef.current = true;
      try {
        const server = await fetchFavorites();
        if (!cancelled) setFavorites(server);
      } finally {
        syncingRef.current = false;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  // Toggle → local + debounced server save
  const debouncedSaveRef = useRef(
    debounce((symbols: string[]) => {
      if (!userKey || userKey === "anon") return;
      if (syncingRef.current) return;
      void saveFavorites(symbols);
    }, 600),
  );

  const toggleFavorite = (key: string) => {
    setFavorites((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (!syncingRef.current && userKey && userKey !== "anon") {
        debouncedSaveRef.current(next);
      }
      return next;
    });
  };

  // Kürasyon + canlı eşleme
  const curatedList: Array<
    Market & { _key: string; _category: string; _matchedKey?: string; _p?: number; _ch?: number }
  > = useMemo(() => {
    const rows: Array<Market & { _key: string; _category: string; _matchedKey?: string; _p?: number; _ch?: number }> = [];
    for (const item of INSTRUMENTS) {
      const found = pickLive(pricesMap, item.key, item.display);
      if (!found) continue;

      rows.push({
        symbol: item.display,                      // görünen isim
        price: fmt2(found.price),                  // UI string (xx,xxx.xx)
        change: Number(found.change.toFixed(2)),   // 24s %
        _key: item.key,                            // kürasyon key
        _category: item.category,                  // filtre
        _matchedKey: found.matchedKey,             // backend'in gerçek anahtarı
        _p: found.price,                           // raw price (number)
        _ch: found.change,                         // raw change (number)
      });
    }

    rows.sort(
      (a, b) =>
        (favorites.includes(b._key) ? 1 : 0) - (favorites.includes(a._key) ? 1 : 0) ||
        a.symbol.localeCompare(b.symbol),
    );
    return rows;
  }, [pricesMap, favorites]);

  // Filtre + arama
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = curatedList;
    if (active === "★")         base = base.filter((m) => favorites.includes(m._key));
    else if (active !== "Tümü") base = base.filter((m) => m._category === active);
    if (q) base = base.filter((m) => m.symbol.toLowerCase().includes(q));
    return base;
  }, [active, favorites, query, curatedList]);

  const emptyState = curatedList.length === 0 && !query;

  return (
    <aside className="flex h-[63vh] flex-col rounded-lg border border-white/10 bg-[#0E2E51]">
      {/* Arama */}
      <div className="flex items-center gap-2 border-b border-white/10 p-3">
        <div className="relative grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara"
            className="w-full rounded-md bg-[#0B2540] pl-9 pr-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 text-white"
          />
        </div>
      </div>

      {/* Kategoriler */}
      <div className="px-3 py-2">
        <div className="flex w-full items-center justify-between text-[11px] text-slate-300">
          {categories.map((t) => {
            const isActive = active === t;
            const isStar = t === "★";
            return (
              <button
                key={t}
                onClick={() => setActive(t)}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
                  isActive ? "bg-white/10 text-white" : "hover:bg-white/10"
                }`}
                aria-label={isStar ? "Favoriler" : t}
                title={isStar ? "Favoriler" : t}
                type="button"
              >
                {isStar ? (
                  <Star
                    className="h-3 w-3"
                    fill={isActive ? "currentColor" : "none"}
                    strokeWidth={isActive ? 0 : 2}
                  />
                ) : (
                  t
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste */}
      <div className="nice-scroll flex-1 min-h-0 overflow-auto">
        {emptyState ? (
          <div className="grid h-full place-items-center p-4">
            <p className="text-sm md:text-base text-slate-400 text-center leading-relaxed">
              Henüz enstrümanlar listelenemiyor. <br />
              (Canlı fiyat bağlantısını kontrol edin...)
            </p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((m) => (
            <MarketRow
              key={m._key}
              symbol={m.symbol}
              price={m.price}
              change={m.change}
              isFavorite={favorites.includes(m._key)}
              onToggleFavorite={() => toggleFavorite(m._key)}
              onSelect={() =>
                onSelectSymbol?.(m.symbol, m._matchedKey ?? m._key, m._p, m._ch)
              }
              selected={selectedSymbol === m.symbol}
            />
          ))
        ) : (
          <div className="grid h-full place-items-center p-4">
            <p className="text-sm md:text-base text-slate-400 text-center">
              Sonuç bulunamadı.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
