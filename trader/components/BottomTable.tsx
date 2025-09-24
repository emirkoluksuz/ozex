// components/BottomTable.tsx
"use client";
import { useEffect } from "react";
import OrdersGrid from "@/components/OrdersGrid";
import HistoryGrid from "@/components/HistoryGrid";

export default function BottomTable({
  tab,
  setTab,
}: {
  tab: "orders" | "history";
  setTab: (t: "orders" | "history") => void;
}) {
  const isOrders  = tab === "orders";
  const isHistory = tab === "history";

  // ✅ Tab değişiminde ilgili event’i tetikle
  useEffect(() => {
    if (isOrders) {
      window.dispatchEvent(new CustomEvent("orders:refresh"));
    } else if (isHistory) {
      window.dispatchEvent(new CustomEvent("history:refresh"));
    }
  }, [isOrders, isHistory]);

  return (
    <section
      className="mt-4 rounded-lg border border-white/10 bg-[#0E2E51] overflow-hidden"
      style={{ overflowAnchor: "none" }}
    >
      {/* Butonlar */}
      <div
        className="flex items-center gap-2 border-b border-white/10 px-2 py-2 text-sm"
        role="tablist"
        aria-label="Alt tablolar"
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          role="tab"
          aria-selected={isOrders}
          onClick={() => setTab("orders")}
          className={`px-4 py-2 rounded-lg ${isOrders ? "bg-[#1a395a]" : "hover:bg-white/10"}`}
        >
          Açık Emirler
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          role="tab"
          aria-selected={isHistory}
          onClick={() => setTab("history")}
          className={`px-4 py-2 rounded-lg ${isHistory ? "bg-[#1a395a]" : "hover:bg-white/10"}`}
        >
          Emir Geçmişi
        </button>
      </div>

      {/* Başlık şeridi */}
      <div className="bg-[#1a395a] w-full text-xs text-slate-200">
        <div className="grid grid-cols-11 w-full">
          {[
            "TARİH", "SEMBOL", "YÖN", "GİRİŞ FİYATI", "PİYASA FİYATI",
            "MİKTAR", "TEMİNAT", "KAR/ZARAR", "TP/SL", "DURUM", "İŞLEM",
          ].map((h) => (
            <div key={h} className="px-3 py-2 font-medium text-center">
              {h}
            </div>
          ))}
        </div>
      </div>

      {/* İçerik */}
      <div className="w-full relative" style={{ minHeight: 260, overflowAnchor: "none" }}>
        <div style={{ display: isOrders ? "block" : "none" }}>
          <OrdersGrid />
        </div>
        <div style={{ display: isHistory ? "block" : "none" }}>
          <HistoryGrid />
        </div>
      </div>
    </section>
  );
}
