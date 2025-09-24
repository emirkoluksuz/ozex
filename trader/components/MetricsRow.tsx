// src/components/MetricsRow.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "@/lib/http";

function findToken(): string | undefined {
  try {
    if (typeof window !== "undefined") {
      const w = window as unknown as { __ACCESS_TOKEN__?: unknown; localStorage?: Storage };
      const raw = w.__ACCESS_TOKEN__;
      if (typeof raw === "string" && raw.trim()) return raw.replace(/^Bearer\s+/i, "");
      if (w.localStorage) {
        const keys = ["access_token", "token", "jwt", "id_token"];
        for (const k of keys) {
          const v = w.localStorage.getItem(k);
          if (v) return v.replace(/^Bearer\s+/i, "");
        }
      }
    }
  } catch {}
  return undefined;
}

type WalletResp = {
  balanceUSD?: number;
  balanceText?: string;
  updatedAt?: string;
  marginUsd?: number;
  freeMarginUsd?: number;
  assetValue?: number;
  marginLevel?: number;
};

const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MetricsRow() {
  const [balance, setBalance] = useState("--");
  const [asset, setAsset] = useState("0.00");
  const [margin, setMargin] = useState("0.00");
  const [freeMargin, setFreeMargin] = useState("0.00");
  const [marginLevel, setMarginLevel] = useState("0.00");

  const etagRef = useRef<string | null>(null);

  // ⇣ Her zaman Record<string,string> döndür (koşullu ekle)
  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    const t = findToken();
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const headers: Record<string, string> = { ...authHeaders };
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;

        const res = await http.get<WalletResp>("/api/wallet/balance", {
          headers,
          withCredentials: true,
          validateStatus: (s) => s === 200 || s === 304 || s === 401 || s === 403,
        });

        if (cancelled) return;
        if (res.status === 304 || res.status === 401 || res.status === 403) return;

        if (res.status === 200) {
          const et = (res.headers?.etag as string) || null;
          etagRef.current = et;

          const data = res.data || {};
          const bal = data.balanceUSD ?? 0;
          const mar = data.marginUsd ?? 0;
          const fr  = data.freeMarginUsd ?? bal - mar;
          const eq  = data.assetValue ?? bal;
          const ml  = data.marginLevel ?? (mar > 0 ? (eq / mar) * 100 : 0);

          setBalance(nf2.format(bal));
          setMargin(nf2.format(mar));
          setFreeMargin(nf2.format(fr));
          setAsset(nf2.format(eq));
          setMarginLevel(nf2.format(ml));
        }
      } catch {
        // sessiz geç
      }
    };

    fetchOnce();
    const id = setInterval(fetchOnce, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authHeaders]);

  const CardStat = ({ title, value, unit }: { title: string; value: string; unit: string }) => {
    const colorMap: Record<string, string> = {
      Bakiye: "text-emerald-400",
      Varlık: "text-yellow-400",
      Teminat: "text-orange-400",
      "Serbest Teminat": "text-blue-400",
      Kredi: "text-purple-400",
      "Teminat Seviyesi": "text-red-400",
    };
    const colorClass = colorMap[title] || "text-slate-100";
    return (
      <div className="rounded-md border border-white/10 bg-[#0E2E51] p-4">
        <div className="text-xs text-slate-300">{title}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className={`text-xl font-semibold tabular-nums ${colorClass}`}>{value}</div>
          <div className={`text-xs ${colorClass}`}>{unit}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1760px] px-5 pt-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 xl:grid-cols-6">
        <CardStat title="Bakiye" value={balance} unit="USD" />
        <CardStat title="Varlık" value={asset} unit="USD" />
        <CardStat title="Teminat" value={margin} unit="USD" />
        <CardStat title="Serbest Teminat" value={freeMargin} unit="USD" />
        <CardStat title="Kredi" value="0.00" unit="USD" />
        <CardStat title="Teminat Seviyesi" value={marginLevel} unit="%" />
      </div>
    </div>
  );
}
