// src/hooks/useInstrumentPrice.ts
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "@/lib/http";
import { io, Socket } from "socket.io-client";

type SnapshotRow = {
  symbol: string;
  current: number;
  lastLive: number;
  mode: string;
  change24h?: number;
  changeDaily?: number;
};

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
const withSlash = (s: string) => (s.length === 6 ? `${s.slice(0,3)}/${s.slice(3)}` : s);

const variantsFor = (display?: string) => {
  if (!display) return [] as string[];
  const D = display.toUpperCase().trim();  // "BTC/USDT"
  const NS = D.replace(/\//g, "");         // "BTCUSDT"
  const base = [D, NS, withSlash(NS)];
  const usdFlip: string[] = [];
  if (NS.endsWith("USDT")) usdFlip.push(NS.replace(/USDT$/, "USD"));
  if (NS.endsWith("USD"))  usdFlip.push(NS.replace(/USD$/, "USDT"));
  return uniq([
    ...base,
    ...usdFlip,
    ...usdFlip.map(withSlash),
    ...base.map((x) => x.replace(/\//g, "")),
    ...base.map((x) => withSlash(x.replace(/\//g, ""))),
  ]);
};

export function useInstrumentPrice(
  displaySymbol?: string,
  preferKey?: string,              // ⬅️ backend key öncelik
  initialPrice?: number,           // ⬅️ MarketList’ten hızlı render
  initialChangePct?: number,       // ⬅️ MarketList’ten hızlı render
) {
  const [price, setPrice] = useState<number | null>(initialPrice ?? null);
  const [changePct, setChangePct] = useState<number>(initialChangePct ?? 0);
  const [mode, setMode] = useState<string>("LIVE");
  const sockRef = useRef<Socket | null>(null);

  const keys = useMemo(() => {
    const v = variantsFor(displaySymbol);
    // preferKey'i en başa al
    const pk = preferKey ? preferKey.toUpperCase() : null;
    return pk ? [pk, ...v.filter((x) => x.toUpperCase() !== pk)] : v;
  }, [displaySymbol, preferKey]);

  const keySet = useMemo(() => new Set(keys.map((k) => k.toUpperCase())), [keys]);

  // REST snapshot: sırayla dene, ilk başarılıda dur
  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const k of keys) {
        try {
          const { data } = await http.get<SnapshotRow>(`/api/prices/${encodeURIComponent(k)}`);
          if (cancelled || !data) continue;
          setPrice(Number(data.current));
          setMode(String(data.mode ?? "LIVE"));
          const ch = typeof data.change24h === "number"
            ? data.change24h
            : typeof data.changeDaily === "number"
            ? data.changeDaily
            : undefined;
          if (typeof ch === "number") setChangePct(ch);
          return;
        } catch {/* diğer varyanta devam */}
      }
      if (!cancelled && initialPrice == null) setPrice(null);
    })();

    return () => { cancelled = true; };
  }, [keys, initialPrice]);

  // WS: tüm varyantları dinle, eşleşenlerde güncelle
  useEffect(() => {
    if (keys.length === 0) return;
    const base = http.defaults.baseURL?.replace(/\/+$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const socket = io(`${base}/prices`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
    });
    sockRef.current = socket;

    const onUpd = (msg: any) => {
      const sym = String(msg?.symbol ?? "").toUpperCase();
      const symNS = sym.replace(/\//g, "");
      if (!keySet.has(sym) && !keySet.has(symNS)) return;

      if (typeof msg.price === "number") setPrice(msg.price);
      if (msg?.mode) setMode(String(msg.mode));
      const ch = typeof msg.change24h === "number"
        ? msg.change24h
        : typeof msg.changeDaily === "number"
        ? msg.changeDaily
        : undefined;
      if (typeof ch === "number") setChangePct(ch);
    };

    socket.on("price:update", onUpd);
    return () => { socket.off("price:update", onUpd); socket.close(); sockRef.current = null; };
  }, [keySet, keys]);

  return { price, changePct, mode };
}
