// /components/HistoryGrid.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { http } from "@/lib/http";

export type HistoryRow = {
  id: string;
  ts: string;
  symbol: string;
  side: "BUY" | "SELL";
  entry: number;
  exit: number;
  qty: number;
  margin?: number | null;
  tp?: number | null;
  sl?: number | null;
  status: "CLOSED" | "CANCELED";
};

type Props = {
  data?: HistoryRow[];
  pageSize?: number;
  onRowClick?: (row: HistoryRow) => void;
  /** Sekme görünürlüğü: false ise fetch durur */
  active?: boolean;
};

const DEFAULT_PAGE_SIZE = 5;

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8, useGrouping: true });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : nf.format(n));
const fmt2 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : nf2.format(n));
const fmtSigned = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${n < 0 ? "-" : n > 0 ? "+" : ""}${nf2.format(Math.abs(n))}`;

/* 3sn auto-hide Toast */
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="pointer-events-auto fixed right-3 z-[60] rounded-lg border px-3 py-[9px] text-sm text-white shadow bg-rose-600/90 border-rose-300/50"
      style={{ top: 5 }}
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

const statusTr = (s: HistoryRow["status"]) => (s === "CLOSED" ? "KAPALI" : "İPTAL");

/** Açık emirlerle aynı sözleşme büyüklüğü mantığı */
const guessContractSize = (sym: string) => {
  const k = String(sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (k.includes("XAUUSD")) return 100;
  if (/^[A-Z]{6}$/.test(k)) return 100_000;
  return 1;
};

/** ---- API tipleri (kullandığımız alanlar) ---- */
type ApiInstrument = {
  display?: string;
  key?: string;
};

type ApiOrder = {
  id: string;
  closedAtText?: string;
  closedAt?: string;
  openedAtText?: string;
  openedAt?: string;
  instrument?: ApiInstrument;
  symbol?: string;
  side: "BUY" | "SELL";
  entryPrice: number | string;
  closePrice?: number | string | null;
  qtyLot?: number | string;
  qty?: number | string;
  marginUsd?: number | string | null;
  tpPrice?: number | string | null;
  slPrice?: number | string | null;
  status: "CLOSED" | "CANCELED";
};

type ApiOrdersResponse = { orders?: ApiOrder[] };

/** Güvenli number parse */
function toNum(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return fallback;
    // 1,234.56
    if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
    // 1234,56
    if (/^\d+,\d+$/.test(s)) return Number(s.replace(",", "."));
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Hata mesajı seçici (unknown-safe) */
function pickErrMsg(e: unknown): string {
  const maybeObj = typeof e === "object" && e !== null ? (e as Record<string, unknown>) : null;
  const resp = maybeObj && typeof maybeObj.response === "object" ? (maybeObj.response as Record<string, unknown>) : null;

  const rawData = resp && typeof resp.data !== "undefined" ? resp.data : undefined;
  if (typeof rawData === "string") return rawData;

  const dataObj = typeof rawData === "object" && rawData !== null ? (rawData as Record<string, unknown>) : null;
  if (dataObj && typeof dataObj.message === "string") return dataObj.message;

  if (maybeObj && typeof maybeObj.message === "string") return maybeObj.message;

  return "Bir hata oluştu.";
}

function isCannotGET(e: unknown): boolean {
  const maybeObj = typeof e === "object" && e !== null ? (e as Record<string, unknown>) : null;
  const resp = maybeObj && typeof maybeObj.response === "object" ? (maybeObj.response as Record<string, unknown>) : null;

  const status = typeof resp?.status === "number" ? (resp!.status as number) : undefined;
  if (status === 404) return true;

  const rawData = resp && typeof resp.data !== "undefined" ? resp.data : undefined;
  return typeof rawData === "string" && rawData.startsWith("Cannot GET");
}

/** API -> HistoryRow map */
function mapRows(src: unknown[]): HistoryRow[] {
  return (src ?? []).map((raw) => {
    const o = raw as ApiOrder;
    const entry = toNum(o.entryPrice);
    const exit = o.closePrice != null ? toNum(o.closePrice, entry) : entry;

    return {
      id: String(o.id),
      ts:
        (o.closedAtText as string | undefined) ??
        (o.closedAt as string | undefined) ??
        (o.openedAtText as string | undefined) ??
        (o.openedAt as string | undefined) ??
        "",
      symbol: o.instrument?.display ?? o.instrument?.key ?? o.symbol ?? "-",
      side: o.side,
      entry,
      exit,
      qty: toNum(o.qtyLot ?? o.qty, 0),
      margin: o.marginUsd != null ? toNum(o.marginUsd) : null,
      tp: o.tpPrice != null ? toNum(o.tpPrice) : null,
      sl: o.slPrice != null ? toNum(o.slPrice) : null,
      status: o.status,
    };
  });
}

export default function HistoryGrid({ data, pageSize = DEFAULT_PAGE_SIZE, onRowClick, active }: Props) {
  const useApi = !data;
  const [rows, setRows] = useState<HistoryRow[]>(data ?? []);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string } | null>(null);

  const showErr = (msg: string) => setToast({ msg });
  const PRIMARY = "/api/orders";
  const ALT = "/orders";

  const stopRef = useRef(false);

  async function fetchOnce(base: string, status: "CLOSED" | "CANCELED") {
    const { data: res } = await http.get<ApiOrdersResponse>(`${base}?status=${status}`);
    return mapRows(res?.orders ?? []);
  }

  async function fetchHistory() {
    if (stopRef.current) return;
    try {
      setLoading(true);
      let closed: HistoryRow[] = [];
      let canceled: HistoryRow[] = [];

      try {
        closed = await fetchOnce(PRIMARY, "CLOSED");
      } catch (e) {
        if (isCannotGET(e)) closed = await fetchOnce(ALT, "CLOSED");
        else throw e;
      }

      try {
        canceled = await fetchOnce(PRIMARY, "CANCELED");
      } catch (e) {
        if (isCannotGET(e)) canceled = await fetchOnce(ALT, "CANCELED");
        else throw e;
      }

      const all = [...closed, ...canceled].sort((a, b) => {
        const da = new Date(a.ts).valueOf();
        const db = new Date(b.ts).valueOf();
        return Number.isNaN(db - da) ? 0 : db - da;
      });

      setRows(all);
    } catch (e) {
      showErr(pickErrMsg(e));
    } finally {
      setLoading(false);
    }
  }

  // İlk mount + dış veri
  useEffect(() => {
    if (!useApi) {
      setRows(data || []);
      return;
    }
    stopRef.current = active === false;
    if (active !== false) {
      fetchHistory();
    }

    const h = () => {
      if (!stopRef.current) fetchHistory();
    };
    window.addEventListener("history:refresh", h as unknown as EventListener);
    window.addEventListener("orders:refresh", h as unknown as EventListener);
    return () => {
      window.removeEventListener("history:refresh", h as unknown as EventListener);
      window.removeEventListener("orders:refresh", h as unknown as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useApi]);

  // Sekme görünürlüğü değişince davranış
  useEffect(() => {
    if (!useApi) return;
    if (active === false) {
      stopRef.current = true;
    } else if (active) {
      stopRef.current = false;
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // sayfalama
  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length, pageSize]);
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  const start = page * pageSize;
  const pageRows = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  // ✅ Açık emirlerle aynı PnL formülü
  const calcPnL = (r: HistoryRow) => {
    const cs = guessContractSize(r.symbol);
    const diff = r.side === "BUY" ? r.exit - r.entry : r.entry - r.exit;
    return diff * cs * r.qty;
  };

  return (
    <div className="w-full relative">
      {toast && <Toast msg={toast.msg} onClose={() => setToast(null)} />}

      {/* İçerik — 5 satır min yükseklik */}
      <div className="w-full text-sm min-h-[220px]">
        {/* Boş state — dikey ortalı */}
        {!loading && pageRows.length === 0 && (
          <div className="w-full border-t border-white/10">
            <div className="relative h-full min-h-[220px]">
              <div className="absolute inset-0 grid place-items-center px-3 text-sm text-slate-400 text-center">
                Emir geçmişiniz bulunmamaktadır.
              </div>
            </div>
          </div>
        )}

        {/* Satırlar */}
        {pageRows.map((r) => {
          const pnl = calcPnL(r);
          const pnlCls = pnl > 0 ? "text-emerald-300" : pnl < 0 ? "text-rose-300" : "text-yellow-300";

          return (
            <div
              key={r.id}
              className="grid grid-cols-11 w-full border-t border-white/10 hover:bg-white/5 cursor-default"
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : -1}
            >
              {/* 1 TARİH */}
              <div className="px-3 py-2 text-center">{r.ts}</div>
              {/* 2 SEMBOL */}
              <div className="px-3 py-2 text-center">{r.symbol}</div>
              {/* 3 YÖN */}
              <div className={`px-3 py-2 text-center ${r.side === "BUY" ? "text-emerald-300" : "text-rose-300"}`}>
                {r.side === "BUY" ? "Uzun" : "Kısa"}
              </div>
              {/* 4 GİRİŞ FİYATI */}
              <div className="px-3 py-2 tabular-nums text-center">{fmtNum(r.entry)}</div>
              {/* 5 ÇIKIŞ FİYATI */}
              <div className="px-3 py-2 tabular-nums text-center">{fmtNum(r.exit)}</div>
              {/* 6 MİKTAR */}
              <div className="px-3 py-2 tabular-nums text-center">
                {fmtNum(r.qty)} <span className="text-white">LOT</span>
              </div>
              {/* 7 TEMİNAT */}
              <div className="px-3 py-2 tabular-nums text-center">{fmt2(r.margin ?? null)}</div>
              {/* 8 KAR/ZARAR */}
              <div className={`px-3 py-2 tabular-nums font-medium text-center ${pnlCls}`}>{fmtSigned(pnl)}</div>
              {/* 9 TP/SL */}
              <div className="px-3 py-2 text-center">
                {r.tp || r.sl ? `${fmtNum(r.tp ?? null)} / ${fmtNum(r.sl ?? null)}` : "—"}
              </div>
              {/* 10 DURUM (TR) */}
              <div className="px-3 py-2 text-center">{statusTr(r.status)}</div>
              {/* 11 İŞLEM */}
              <div className="px-3 py-2 text-center">
                <span className="text-xs text-slate-400">—</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sayfalama — her zaman görünür, altta sabit */}
      <div className="w-full flex items-center justify-between border-t border-white/10 px-2 py-2 text-xs text-slate-300 bg-[#0E2E51]">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded bg-white/10 px-3 py-1 disabled:opacity-40"
        >
          ← Önceki
        </button>
        <span>
          Sayfa {Math.min(page + 1, totalPages)} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="rounded bg-white/10 px-3 py-1 disabled:opacity-40"
        >
          Sonraki →
        </button>
      </div>
    </div>
  );
}
