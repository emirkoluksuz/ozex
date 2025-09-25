// /components/TradePanel.tsx
"use client";
import { useMemo, useState, useEffect } from "react";
import { Plus, Minus, X } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useInstrumentPrice } from "@/hooks/useInstrumentPrice";
import { http } from "@/lib/http";
import type { AxiosError } from "axios";

type Side = "buy" | "sell";

type PlacedOrder = {
  id?: string;
  symbol?: string;
  side?: "BUY" | "SELL";
  qtyLot?: number;
  price?: number;
};

const clean = (s: string) => String(s ?? "").replace(/[^\d.,-]/g, "");
const toNum = (s: string) => {
  const v = clean(s).replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const STEP = 0.1;
const clamp2 = (v: number) => Math.max(0, Number(v.toFixed(2)));
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatUSD2 = (n: number) =>
  !Number.isFinite(n) ? "—" : `${n < 0 ? "-" : ""}$${nf2.format(Math.abs(n))}`;
const formatUSD2Sfx = (n: number) =>
  !Number.isFinite(n) ? "—" : `${nf2.format(Math.abs(n))} USD`;
const formatPct = (n: number) => `${n.toFixed(2)}%`;

function getContractValue(sym?: string) {
  const k = String(sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (k.includes("XAUUSD")) return 100;
  if (/^[A-Z]{6}$/.test(k)) return 100_000;
  return 1;
}

/* ========== Axios yardımcıları (tipli) ========== */
function isAxiosError<T = unknown>(e: unknown): e is AxiosError<T> {
  return typeof e === "object" && e !== null && "isAxiosError" in (e as Record<string, unknown>);
}

function pickErrMsg(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as unknown;
    const fromBody =
      typeof data === "string"
        ? data
        : typeof data === "object" && data !== null && "message" in data
        ? (data as { message?: unknown }).message
        : undefined;

    const msg =
      (typeof fromBody === "string" && fromBody) ||
      (e.message ?? "İşlem başlatılamadı.");

    if (msg.includes("INSUFFICIENT_BALANCE")) return "Yetersiz bakiye.";
    return msg;
  }
  return (e as Error)?.message || "İşlem başlatılamadı.";
}

/* 3sn auto-hide toast — timer msg/kind değişiminde yenilenir */
function Toast({
  kind = "error",
  msg,
  onClose,
}: {
  kind?: "error" | "success";
  msg: string;
  onClose: () => void;
}) {
  const tone =
    kind === "success"
      ? "bg-emerald-500/90 border-emerald-300/50"
      : "bg-rose-600/90 border-rose-300/50";
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [msg, kind, onClose]);
  return (
    <div
      className={`pointer-events-auto fixed right-3 z-[60] rounded-lg border px-3 py-2 text-sm text-white shadow ${tone}`}
      style={{ top: 6 }}
    >
      <div className="flex items-center gap-2">
        <span className="truncate">{msg}</span>
        <button
          onClick={onClose}
          className="ml-2 grid h-6 w-6 place-items-center rounded-full bg-white/20 hover:bg-white/30"
          aria-label="Kapat"
          title="Kapat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function TradePanel({
  symbol = "XAU/USD",
  backendKey,
  initialPrice,
  initialChangePct,
  sideState,
  onPlaced,
}: {
  symbol?: string;
  backendKey?: string;
  initialPrice?: number;
  initialChangePct?: number;
  sideState?: [Side, (v: Side) => void];
  onPlaced?: (order: PlacedOrder | unknown) => void;
}) {
  const { balanceUSD } = useWallet();

  const { price: lastPrice, changePct } = useInstrumentPrice(
    symbol,
    backendKey,
    initialPrice,
    initialChangePct,
  );

  const [internalSide, setInternalSide] = useState<Side>("buy");
  const side = sideState ? sideState[0] : internalSide;
  const setSide = sideState ? sideState[1] : setInternalSide;

  const [lotStr, setLotStr] = useState("0.00");
  const [tpStr, setTpStr] = useState("");
  const [slStr, setSlStr] = useState("");

  const lot = toNum(lotStr);

  const leverage = 400;
  const contractValue = getContractValue(symbol);

  const margin = useMemo(() => {
    if (!lastPrice || !lot) return 0;
    return (lastPrice * contractValue * lot) / leverage;
  }, [lastPrice, lot, contractValue]);

  const tpInfo = useMemo(() => {
    const tp = toNum(tpStr);
    if (!tpStr || !lot || !lastPrice) return null;
    const distance = Math.abs((tp - lastPrice) / lastPrice) * 100;
    const rawProfit =
      side === "buy"
        ? (tp - lastPrice) * contractValue * lot
        : (lastPrice - tp) * contractValue * lot;
    return {
      tpPriceText: formatUSD2Sfx(tp),
      distanceText: formatPct(distance),
      profitText: formatUSD2(Math.max(0, Math.abs(rawProfit))),
    };
  }, [tpStr, lot, side, lastPrice, contractValue]);

  const slInfo = useMemo(() => {
    const sl = toNum(slStr);
    if (!slStr || !lot || !lastPrice) return null;
    const distance = Math.abs((lastPrice - sl) / lastPrice) * 100;
    const rawLoss =
      side === "buy"
        ? (lastPrice - sl) * contractValue * lot
        : (sl - lastPrice) * contractValue * lot;
    return {
      slPriceText: formatUSD2Sfx(sl),
      distanceText: formatPct(distance),
      lossText: formatUSD2(Math.max(0, Math.abs(rawLoss))),
    };
  }, [slStr, lot, side, lastPrice, contractValue]);

  const inc = () => setLotStr(clamp2(toNum(lotStr) + STEP).toFixed(2));
  const dec = () => setLotStr(clamp2(toNum(lotStr) - STEP).toFixed(2));

  const blockWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const numericOnChange =
    (setter: (s: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setter(clean(e.target.value));
  const numericOnKeyDown =
    (setter: (s: string) => void, current: () => number) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setter(clamp2(current() + STEP).toFixed(2));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setter(clamp2(current() - STEP).toFixed(2));
      }
    };

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "error" | "success"; msg: string } | null>(null);

  const showErr = (m: string) => setToast({ kind: "error", msg: m });
  const showOk = (m: string) => setToast({ kind: "success", msg: m });

  async function submitOrder() {
    if (!lot || lot <= 0) {
      showErr("Lot girmelisiniz.");
      return;
    }
    if (!symbol) {
      showErr("Sembol seçiniz.");
      return;
    }
    if (!lastPrice) {
      showErr("Fiyat bulunamadı. Lütfen sembol için fiyat sağlayın.");
      return;
    }

    const tp = tpStr ? toNum(tpStr) : null;
    const sl = slStr ? toNum(slStr) : null;

    if (side === "buy") {
      if (tp != null && !(tp > lastPrice)) {
        showErr("Take Profit seviyesi mevcut fiyattan daha yüksek olmalıdır.");
        return;
      }
      if (sl != null && !(sl < lastPrice)) {
        showErr("Stop Loss seviyesi mevcut fiyattan düşük olmalıdır.");
        return;
      }
    } else {
      if (tp != null && !(tp < lastPrice)) {
        showErr("Take Profit seviyesi mevcut fiyattan daha düşük olmalıdır.");
        return;
      }
      if (sl != null && !(sl > lastPrice)) {
        showErr("Stop Loss seviyesi mevcut fiyattan yüksek olmalıdır.");
        return;
      }
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      const symbolKey = (backendKey || symbol.replace(/[^A-Za-z0-9]/g, "")).toUpperCase();

      const body = {
        symbolKey,
        side: side.toUpperCase() as "BUY" | "SELL",
        type: "MARKET" as const,
        qtyLot: toNum(lotStr),
        tpPrice: tp ?? undefined,
        slPrice: sl ?? undefined,
        price: Number(lastPrice),
      };

      const idem = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`;
      const headers: Record<string, string> = {
        "Idempotency-Key": idem,
        "X-Idempotency-Key": idem,
      };

      // ❗ Sadece /api/orders'a gönder — fallback yok
      const res = await http.post<PlacedOrder | { order: PlacedOrder }>(
        "/api/orders",
        body,
        { headers },
      );

      const payload =
        res?.data && typeof res.data === "object" && res.data !== null && "order" in res.data
          ? (res.data as { order: PlacedOrder }).order
          : (res?.data as PlacedOrder | undefined);

      setLotStr("0.00");
      setTpStr("");
      setSlStr("");
      onPlaced?.(payload ?? {});

      try {
        window.dispatchEvent(new CustomEvent("orders:refresh"));
      } catch {
        /* no-op */
      }
      showOk("Pozisyon başarıyla açıldı.");
    } catch (e: unknown) {
      showErr(pickErrMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  const allOpen = margin > 0 && !!tpInfo && !!slInfo;

  const pctVal = Number(changePct) || 0;
  const pctText = `${pctVal > 0 ? "+" : ""}${pctVal.toFixed(2)}%`;
  const pctClass = pctVal > 0 ? "text-emerald-300" : pctVal < 0 ? "text-rose-300" : "text-yellow-300";

  return (
    <>
      {toast && <Toast kind={toast.kind} msg={toast.msg} onClose={() => setToast(null)} />}

      <aside
        className={`rounded-lg border border-white/10 bg-[#0E2E51] p-3 ${
          allOpen ? "h-[63vh] overflow-hidden" : "h-auto"
        }`}
      >
        {/* Bakiye */}
        <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
          <span>Mevcut Bakiye:</span>
          <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-slate-100">
            <span className="text-xs font-medium tabular-nums">{nf2.format(Number(balanceUSD ?? 0))} USD</span>
          </span>
        </div>

        {/* Sembol & Son fiyat */}
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>
            Sembol: <span className="text-slate-200 font-medium">{symbol}</span>
          </span>
          {lastPrice == null ? (
            <span className="text-rose-300">Son: —</span>
          ) : (
            <span className="text-slate-300 tabular-nums">
              Son: {formatUSD2Sfx(lastPrice)} <span className={`ml-2 ${pctClass}`}>{pctText}</span>
            </span>
          )}
        </div>

        {/* Buy / Sell */}
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-md bg-[#0B2540] p-1 text-sm">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={`rounded px-3 py-2 font-medium ${
              side === "buy" ? "bg-emerald-500 text-white" : "text-slate-200 hover:bg-white/5"
            }`}
            aria-pressed={side === "buy"}
            disabled={submitting}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`rounded px-3 py-2 font-medium ${
              side === "sell" ? "bg-rose-500 text-white" : "text-slate-200 hover:bg-white/5"
            }`}
            aria-pressed={side === "sell"}
            disabled={submitting}
          >
            Sell
          </button>
        </div>

        {/* Lot */}
        <FormField label="Lot">
          <div
            className="flex items-center rounded-md bg-[#0B2540] select-none overscroll-contain"
            onWheelCapture={blockWheel}
          >
            <button
              type="button"
              aria-label="Lot azalt"
              className="grid h-9 w-9 flex-none place-items-center rounded-l-md hover:bg-white/10"
              onClick={dec}
              disabled={submitting}
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              value={lotStr}
              onChange={numericOnChange(setLotStr)}
              onWheel={blockWheel}
              onKeyDown={numericOnKeyDown(setLotStr, () => toNum(lotStr))}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-transparent text-center outline-none text-sm tabular-nums"
              type="text"
              disabled={submitting}
              aria-label="Lot"
            />
            <button
              type="button"
              aria-label="Lot artır"
              className="grid h-9 w-9 flex-none place-items-center rounded-r-md hover:bg-white/10"
              onClick={inc}
              disabled={submitting}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </FormField>

        {/* TP / SL */}
        <FormField label="Take Profit">
          <input
            value={tpStr}
            onChange={numericOnChange(setTpStr)}
            onWheel={blockWheel}
            inputMode="decimal"
            placeholder="Fiyat gir"
            className="w-full rounded-md bg-[#0B2540] px-3 py-2 text-sm outline-none tabular-nums"
            type="text"
            disabled={submitting}
            aria-label="Take Profit"
          />
        </FormField>
        <FormField label="Stop Loss">
          <input
            value={slStr}
            onChange={numericOnChange(setSlStr)}
            onWheel={blockWheel}
            inputMode="decimal"
            placeholder="Fiyat gir"
            className="w-full rounded-md bg-[#0B2540] px-3 py-2 text-sm outline-none tabular-nums"
            type="text"
            disabled={submitting}
            aria-label="Stop Loss"
          />
        </FormField>

        {/* Submit */}
        <button
          type="button"
          onClick={submitOrder}
          disabled={submitting || lastPrice == null}
          className={`mt-3 w-full rounded-md px-3 py-2 font-semibold shadow ${
            side === "buy" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          } ${submitting || lastPrice == null ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {submitting ? "Gönderiliyor..." : side === "buy" ? "Buy" : "Sell"}
        </button>

        {/* Teminat */}
        {margin > 0 && (
          <div className="mt-3">
            <InfoBadgeWide label="Bağlanacak Teminat" value={formatUSD2Sfx(margin)} />
          </div>
        )}

        {/* TP/SL özet */}
        {tpInfo && (
          <div className="mt-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-2.5 text-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-emerald-300/80">Take Profit</span>
              <span className="text-[12px] font-medium tabular-nums">{tpInfo.tpPriceText}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[12px]">
              <span className="opacity-80">Mesafe: {tpInfo.distanceText}</span>
              <span className="opacity-80">
                Kar: <span className="font-medium tabular-nums">{tpInfo.profitText}</span>
              </span>
            </div>
          </div>
        )}
        {slInfo && (
          <div className="mt-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 p-2.5 text-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-rose-300/80">Stop Loss</span>
              <span className="text-[12px] font-medium tabular-nums">{slInfo.slPriceText}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[12px]">
              <span className="opacity-80">Mesafe: {slInfo.distanceText}</span>
              <span className="opacity-80">
                Zarar: <span className="font-medium tabular-nums">{slInfo.lossText}</span>
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 text-sm">
      <div className="mb-1 text-xs text-slate-400">{label}</div>
      {children}
    </div>
  );
}
function InfoBadgeWide({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-slate-200 text-center">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
