// app/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import MetricsRow from "@/components/MetricsRow";
import CenterChart from "@/components/CenterChart";
import MarketList from "@/components/MarketList";
import TradePanel from "@/components/TradePanel";
import BottomTable from "@/components/BottomTable";

type SelectedSymbol = {
  display: string;
  key?: string;
  p?: number;
  ch?: number;
};

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sel, setSel] = useState<SelectedSymbol>({ display: "BTC/USDT" });
  const [tab, setTab] = useState<"orders" | "history">("orders");

  // Giriş zorunluluğu: login yoksa yönlendir.
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/");
    }
  }, [loading, user, router]);

  // MarketList -> TradePanel arası seçili sembol güncelleme callback'i (re-render optimizasyonu)
  const handleSelectSymbol = useCallback(
    (display: string, backendKey?: string, p?: number, ch?: number) => {
      setSel({ display, key: backendKey, p, ch });
    },
    []
  );

  // TradePanel’e giden props’ları memorized et (gereksiz render azaltır)
  const tradePanelProps = useMemo(
    () => ({
      symbol: sel.display,
      backendKey: sel.key,
      initialPrice: sel.p,
      initialChangePct: sel.ch,
    }),
    [sel.display, sel.key, sel.p, sel.ch]
  );

  if (loading || !user) {
    // Her zaman bir içerik render et (CLS/LCP için basit skeleton)
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0B2540] text-slate-100">
        <div className="rounded-lg border border-white/10 bg-[#0E2E51] px-4 py-2 text-sm">
          Oturum doğrulanıyor…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B2540] text-slate-100">
      <Header />
      <MetricsRow />

      <main className="mx-auto grid max-w-[1760px] grid-cols-12 gap-4 px-5 pt-4">
        <div className="col-span-12 lg:col-span-3">
          <MarketList
            selectedSymbol={sel.display}
            onSelectSymbol={handleSelectSymbol}
          />
        </div>

        <div className="col-span-12 lg:col-span-6">
          <CenterChart />
        </div>

        <div className="col-span-12 lg:col-span-3">
          <TradePanel {...tradePanelProps} />
        </div>
      </main>

      <div className="mx-auto max-w-[1760px] px-5 pb-6">
        <BottomTable tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
