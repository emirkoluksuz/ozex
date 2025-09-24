// src/hooks/usePrices.ts
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { http } from "@/lib/http";

type PriceMsg = {
  symbol: string;
  price: number;
  mode: string;
  lastLive: number;
  change24h: number;
  leverage?: number;
};
type MapT = Record<string, PriceMsg>;

export function usePrices() {
  const [prices, setPrices] = useState<MapT>({});
  const sockRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 1) Snapshot
    (async () => {
      try {
        const { data } = await http.get("/api/prices");
        if (!cancelled && Array.isArray(data)) {
          const map: MapT = {};
          for (const it of data) {
            map[it.symbol] = {
              symbol: it.symbol,
              price: it.current,
              mode: it.mode,
              lastLive: it.lastLive,
              change24h:
                typeof it.change24h === "number"
                  ? it.change24h
                  : typeof it.changeDaily === "number"
                  ? it.changeDaily
                  : 0,
              leverage:
                typeof it.leverage === "number" && it.leverage > 0 ? it.leverage : 400,
            };
          }
          setPrices(map);
        }
      } catch (err) {
        console.error("snapshot error", err);
      }
    })();

    // 2) WS – origin’i sağlamlaştır, polling fallback aç
    const baseFromHttp = http.defaults.baseURL?.replace(/\/+$/, "");
    const origin =
      baseFromHttp ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const socket = io(`${origin}/prices`, {
      withCredentials: true,
      // polling fallback aç (bazı ortamlarda sadece websocket başarısız olabiliyor)
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionAttempts: Infinity,
    });

    sockRef.current = socket;

    socket.on("connect_error", (e) => {
      console.warn("socket connect_error", e?.message || e);
    });

    socket.on("price:update", (msg: any) => {
      setPrices((prev) => {
        const old = prev[msg?.symbol];
        const change =
          typeof msg?.change24h === "number"
            ? msg.change24h
            : typeof msg?.changeDaily === "number"
            ? msg.changeDaily
            : old?.change24h ?? 0;

        const leverage =
          typeof msg?.leverage === "number" && msg.leverage > 0
            ? msg.leverage
            : old?.leverage ?? 400;

        return {
          ...prev,
          [msg.symbol]: {
            symbol: msg.symbol,
            price: msg.price,
            mode: msg.mode,
            lastLive: msg.lastLive,
            change24h: change,
            leverage,
          },
        };
      });
    });

    return () => {
      cancelled = true;
      socket.close();
      sockRef.current = null;
    };
  }, []);

  return { prices };
}
