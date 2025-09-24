// app/page.tsx (sizin paylaştığınızın üstüne küçük rötuş)
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import MetricsRow from "@/components/MetricsRow";
import CenterChart from "@/components/CenterChart";
import MarketList from "@/components/MarketList";
import TradePanel from "@/components/TradePanel";
import BottomTable from "@/components/BottomTable";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sel, setSel] = useState({ display: "BTC/USDT" } as { display: string; key?: string; p?: number; ch?: number });
  const [tab, setTab] = useState<"orders" | "history">("orders");

  useEffect(() => {
    if (!loading && !user) {
      // login yoksa hemen login’e git
      router.replace("/login?next=/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    // ⬇️ Her zaman bir içerik render et
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
      <main className="mx-auto max-w-[1760px] grid grid-cols-12 gap-4 px-5 pt-4">
        <div className="col-span-3">
          <MarketList
            selectedSymbol={sel.display}
            onSelectSymbol={(display, backendKey, p, ch) => setSel({ display, key: backendKey, p, ch })}
          />
        </div>
        <div className="col-span-6">
          <CenterChart />
        </div>
        <div className="col-span-3">
          <TradePanel symbol={sel.display} backendKey={sel.key} initialPrice={sel.p} initialChangePct={sel.ch} />
        </div>
      </main>
      <div className="mx-auto max-w-[1760px] px-5 pb-6">
        <BottomTable tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
