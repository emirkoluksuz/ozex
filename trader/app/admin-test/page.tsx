// app/admin-test/page.tsx
"use client";

import { useEffect, useMemo, useState, ReactNode } from "react";
import {
  adminListPending,
  adminAct,
  adminAdjust,
  adminReconcile,
  adminReconcileAll,
} from "@/utils/adminApi";

// Fiyat kontrol yardımcıları
import { driftBackToLive, driftToTarget, goLiveNow } from "@/utils/adminPrice";
// Canlı fiyatlar
import { usePrices } from "@/hooks/usePrices";

/* ---------- Tipler (yalnız bu sayfa için) ---------- */
type FundingType = "DEPOSIT" | "WITHDRAW";
type FundingStatus = "PENDING" | "APPROVED" | "REJECTED";

interface FundingItem {
  id: string;
  userId: string;
  type: FundingType;
  amount: string | number;
  reference?: string | null;
  createdAt: string;
  status: FundingStatus;
}

type PriceMode = "LIVE" | "TO_TARGET" | "TO_LIVE";
interface LiveInfo {
  price: number;
  lastLive: number;
  mode: PriceMode;
}
type PricesMap = Record<string, LiveInfo | undefined>;

/* ---------- Sayfa ---------- */
export default function AdminTestPage() {
  // --- Funding state ---
  const [items, setItems] = useState<FundingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [note, setNote] = useState<string>("");
  const [adjustUser, setAdjustUser] = useState<string>("");
  const [adjustAmount, setAdjustAmount] = useState<string>("");

  // --- Price Controls state ---
  const [sym, setSym] = useState<string>("BTC/USDT");
  const [target, setTarget] = useState<string>("115010");
  const [intervalSec, setIntervalSec] = useState<string>("10");
  const [tickSize, setTickSize] = useState<string>("1");
  const [sending, setSending] = useState<boolean>(false);

  // Canlı fiyatlar
  const { prices } = usePrices() as { prices: PricesMap };
  const liveInfo = prices[sym];

  const modeBadge: ReactNode = useMemo(() => {
    const m = liveInfo?.mode ?? "—";
    const base = "px-2 py-0.5 rounded-full text-xs border";
    if (m === "LIVE") return <span className={`${base} border-emerald-500/40 text-emerald-300`}>LIVE</span>;
    if (m === "TO_TARGET") return <span className={`${base} border-amber-500/40 text-amber-300`}>TO_TARGET</span>;
    if (m === "TO_LIVE") return <span className={`${base} border-sky-500/40 text-sky-300`}>TO_LIVE</span>;
    return <span className={`${base} border-white/20 text-slate-300`}>—</span>;
  }, [liveInfo]);

  async function load() {
    setLoading(true);
    try {
      const res = await adminListPending();
      setItems((res?.items ?? []) as FundingItem[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Küçük yardımcı: number parse
  const num = (s: string, def = 0): number => {
    const n = Number(s);
    return Number.isFinite(n) ? n : def;
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-bold">Admin Test Panel</h1>

      {/* ====================== PRICE CONTROLS ====================== */}
      <section className="space-y-4 rounded border border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Price Controls</div>
          <div className="text-xs text-slate-400">10 sn’de 1 birim adımıyla hedefe/ canlıya yürüt</div>
        </div>

        {/* Sembol ve canlı bilgi */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <label className="w-24 text-sm text-slate-300">Symbol</label>
            <input
              className="flex-1 px-2 py-1 rounded border border-slate-300 bg-white text-black placeholder:text-slate-500"
              value={sym}
              onChange={(e) => setSym(e.target.value.trim())}
              placeholder="BTC/USDT"
            />
          </div>
          <div className="text-sm text-slate-300 flex items-center gap-2">
            <span>Mode:</span> {modeBadge}
          </div>
          <div className="text-sm text-slate-300 flex items-center gap-4">
            <div>
              <span className="opacity-70 mr-1">Current:</span>
              <b>{liveInfo ? liveInfo.price : "—"}</b>
            </div>
            <div>
              <span className="opacity-70 mr-1">Live:</span>
              <b>{liveInfo ? liveInfo.lastLive : "—"}</b>
            </div>
          </div>
        </div>

        {/* Hedef ve adım ayarları */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="w-24 text-sm text-slate-300">Target</label>
            <input
              className="flex-1 px-2 py-1 rounded border border-slate-300 bg-white text-black placeholder:text-slate-500"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="115010"
              inputMode="decimal"
            />
            {/* Hızlı +1 / -1 */}
            <div className="flex gap-1">
              <button
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                onClick={() => setTarget(String(num(target) - num(tickSize || "1", 1)))}
              >
                −{tickSize || 1}
              </button>
              <button
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                onClick={() => setTarget(String(num(target) + num(tickSize || "1", 1)))}
              >
                +{tickSize || 1}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="w-24 text-sm text-slate-300">Interval (s)</label>
            <input
              className="w-28 px-2 py-1 rounded border border-slate-300 bg-white text-black placeholder:text-slate-500"
              value={intervalSec}
              onChange={(e) => setIntervalSec(e.target.value)}
              placeholder="10"
              inputMode="numeric"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-24 text-sm text-slate-300">Tick Size</label>
            <input
              className="w-28 px-2 py-1 rounded border border-slate-300 bg-white text-black placeholder:text-slate-500"
              value={tickSize}
              onChange={(e) => setTickSize(e.target.value)}
              placeholder="1"
              inputMode="decimal"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-60"
              disabled={!sym || !target || sending}
              onClick={async () => {
                setSending(true);
                try {
                  await driftToTarget(sym, num(target), num(intervalSec || "10", 10), num(tickSize || "1", 1));
                } finally {
                  setSending(false);
                }
              }}
            >
              Hedefe Yürüt
            </button>

            <button
              className="px-3 py-2 rounded bg-sky-600 text-white disabled:opacity-60"
              disabled={!sym || sending}
              onClick={async () => {
                setSending(true);
                try {
                  await driftBackToLive(sym, num(intervalSec || "10", 10), num(tickSize || "1", 1));
                } finally {
                  setSending(false);
                }
              }}
            >
              Canlıya Dön
            </button>

            {/* 🔥 Anında canlıya al */}
            <button
              className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
              disabled={!sym || sending}
              onClick={async () => {
                setSending(true);
                try {
                  await goLiveNow(sym);
                } finally {
                  setSending(false);
                }
              }}
            >
              Anında Canlıya Al
            </button>
          </div>
        </div>
      </section>

      {/* ====================== FUNDING CONTROLS ====================== */}
      <section className="space-y-4">
        <div className="flex gap-2 items-center">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={loading}
          >
            Yenile
          </button>

          {/* (Opsiyonel) reconcile-all */}
          <button
            className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-60"
            onClick={async () => {
              await adminReconcileAll();
              await load();
            }}
          >
            Reconcile All
          </button>

          <input
            className="ml-4 px-2 py-1 rounded border border-slate-300 bg-white text-black placeholder:text-slate-500"
            placeholder="Admin Note (ops.)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="rounded border border-white/10">
          {items.length === 0 ? (
            <div className="p-4 text-sm text-slate-300">Bekleyen talep yok.</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {items.map((it) => (
                <li key={it.id} className="p-4 flex items-center justify-between">
                  <div className="text-sm">
                    <div>
                      <b>ID:</b> {it.id}
                    </div>
                    <div>
                      <b>User:</b> {it.userId}
                    </div>
                    <div>
                      <b>Type:</b> {it.type}
                    </div>
                    <div>
                      <b>Amount:</b> {String(it.amount)}
                    </div>
                    {it.reference && (
                      <div>
                        <b>Ref:</b> {it.reference}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded bg-green-600 text-white"
                      onClick={async () => {
                        await adminAct(it.id, true, note || "ok");
                        await load();
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-red-600 text-white"
                      onClick={async () => {
                        await adminAct(it.id, false, note || "reject");
                        await load();
                      }}
                    >
                      Reject
                    </button>
                    {/* (Opsiyonel) tekil reconcile */}
                    <button
                      className="px-3 py-1 rounded bg-amber-700 text-white"
                      onClick={async () => {
                        await adminReconcile(it.id);
                        await load();
                      }}
                      title="Studio'da APPROVED yaptıysan uygular"
                    >
                      Reconcile
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* (Opsiyonel) Adjust aracı */}
        <div className="rounded border border-white/10 p-4 space-y-3">
          <div className="font-semibold">Manual Adjust (dev tool)</div>
          <div className="flex gap-2 items-center">
            <input
              className="px-2 py-1 rounded border border-slate-300 bg-white text-black placeholder:text-slate-500 flex-1"
              placeholder="User ID"
              value={adjustUser}
              onChange={(e) => setAdjustUser(e.target.value)}
            />
            <input
              className="px-2 py-1 rounded border border-slate-300 bg-white text-black placeholder:text-slate-500 w-40"
              placeholder="Amount (±)"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
            />
            <button
              className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
              disabled={!adjustUser || !adjustAmount}
              onClick={async () => {
                await adminAdjust(adjustUser.trim(), Number(adjustAmount), "dev adjust");
                setAdjustAmount("");
              }}
            >
              Adjust
            </button>
          </div>
          <div className="text-xs text-slate-400">
            Not: Adjust, Transaction oluşturur; amount pozitifse +, negatifse − işlem yazar.
          </div>
        </div>
      </section>
    </div>
  );
}
