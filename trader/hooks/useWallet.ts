// src/hooks/useWallet.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "@/lib/http";

/**
 * access token'ı bulmak için birkaç olası kaynağı dener:
 * - window.__ACCESS_TOKEN__ (uygulama globali)
 * - localStorage['access_token' | 'token' | 'jwt']
 * - cookie (httpOnly ise JS göremez; bu durumda withCredentials işe yarar)
 */
function findToken(): string | undefined {
  try {
    // @ts-ignore
    if (typeof window !== "undefined" && window.__ACCESS_TOKEN__) {
      // @ts-ignore
      return String(window.__ACCESS_TOKEN__);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const keys = ["access_token", "token", "jwt", "id_token"];
      for (const k of keys) {
        const v = window.localStorage.getItem(k);
        if (v) return v.replace(/^Bearer\s+/i, "");
      }
    }
  } catch {}
  return undefined;
}

type WalletResponse =
  | { balanceUSD?: number; balanceText?: string; updatedAt?: string }
  | { balance?: string | number; updatedAt?: string };

export function useWallet() {
  const [balanceUSD, setBalanceUSD] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | undefined>(undefined);

  const headersBase = useMemo(() => {
    const t = findToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  useEffect(() => {
    let alive = true;

    async function fetchOnce() {
      try {
        setError(null);
        const { data, headers, status } = await http.get<WalletResponse>(
          "/api/wallet/balance",
          {
            headers: {
              ...(headersBase || {}),
              ...(etagRef.current ? { "If-None-Match": etagRef.current } : {}),
            },
            withCredentials: true, // cookie tabanlı auth varsa
            validateStatus: (s) =>
              s === 200 || s === 304 || s === 401 || s === 403,
          },
        );

        if (!alive) return;

        if (status === 304) {
          // değişiklik yok
          return;
        }

        if (status === 401 || status === 403) {
          // auth yoksa 0 göstermeyelim, net hata verelim
          setError("wallet unauthorized");
          setBalanceUSD(null);
          return;
        }

        // 200
        const et = headers?.["etag"] || headers?.ETag;
        if (et) etagRef.current = String(et);

        // Hem yeni hem eski payload formatlarını destekle
        let next = 0;
        if (data && typeof (data as any).balanceUSD === "number") {
          next = (data as any).balanceUSD as number;
        } else if (data && (data as any).balance != null) {
          const raw = (data as any).balance;
          next =
            typeof raw === "number"
              ? raw
              : Number(String(raw).replace(",", ".")) || 0;
        } else {
          next = 0;
        }

        setBalanceUSD(next);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "wallet error");
        setBalanceUSD(null);
      }
    }

    // İlk çekim + düzenli yenileme
    fetchOnce();
    const id = setInterval(fetchOnce, 5000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [headersBase]);

  return {
    balanceUSD: balanceUSD ?? 0, // TradePanel güvenle toFixed(2) yapabilir
    isLoading: balanceUSD === null && !error,
    error,
  };
}
