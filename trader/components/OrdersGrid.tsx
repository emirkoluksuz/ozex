// /components/OrdersGrid.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { http } from "@/lib/http";
import { useInstrumentPrice } from "@/hooks/useInstrumentPrice";
import type { AxiosError } from "axios";

/* ================== Tipler ================== */
export type OrderRow = {
  id: string;
  ts: string;
  symbol: string;
  side: "BUY" | "SELL";
  entry: number;
  market?: number | null;
  qty: number;
  margin?: number | null;
  tp?: number | null;
  sl?: number | null;
  status: "OPEN" | "CLOSED" | "CANCELED";
};

type Props = {
  status?: "OPEN" | "CLOSED" | "CANCELED" | "ALL";
  pageSize?: number;
  data?: OrderRow[];
  onRowClick?: (row: OrderRow) => void;
  /** BottomTable’dan gelen sekme görünürlüğü */
  active?: boolean;
  /** Dışarıdan “yenile” tetiklemek için token */
  reloadToken?: number;
};

type RawOrder = {
  id: string;
  openedAtText?: string;
  openedAt?: string;
  instrument?: { display?: string; key?: string };
  symbol?: string;
  side: "BUY" | "SELL";
  entryPrice: number | string;
  livePrice?: number | string | null;
  qtyLot?: number | string;
  qty?: number | string;
  marginUsd?: number | string | null;
  tpPrice?: number | string | null;
  slPrice?: number | string | null;
  status: "OPEN" | "CLOSED" | "CANCELED";
};

type OrdersResp = { orders: RawOrder[] };

/* ================== Format yardımcıları ================== */
const DEFAULT_PAGE_SIZE = 5;

const nf  = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8, useGrouping: true });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtNum = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : nf.format(n));
const fmt2   = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : nf2.format(n));
const fmtSigned = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${n < 0 ? "-" : n > 0 ? "+" : ""}${nf2.format(Math.abs(n))}`;

/* ================== Küçük yardımcılar ================== */
const statusTr = (s: OrderRow["status"]) => (s === "OPEN" ? "AÇIK" : s === "CLOSED" ? "KAPALI" : "İPTAL");

const guessContractSize = (sym: string) => {
  const k = String(sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (k.includes("XAUUSD")) return 100;
  if (/^[A-Z]{6}$/.test(k)) return 100_000;
  return 1;
};

function rowsChanged(a: OrderRow[], b: OrderRow[]) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (!y || x.id !== y.id) return true;
    if (
      x.status !== y.status ||
      x.entry !== y.entry ||
      x.market !== y.market ||
      x.qty !== y.qty ||
      x.margin !== y.margin ||
      x.tp !== y.tp ||
      x.sl !== y.sl ||
      x.side !== y.side ||
      x.symbol !== y.symbol ||
      x.ts !== y.ts
    ) return true;
  }
  return false;
}

function isAxiosError<T = unknown>(e: unknown): e is AxiosError<T> {
  return typeof e === "object" && e !== null && (e as { isAxiosError?: unknown }).isAxiosError === true;
}

function getHttpStatus(e: unknown): number | undefined {
  return isAxiosError(e) ? e.response?.status : undefined;
}

function respStartsWithCannot(e: unknown, method: "GET" | "POST") {
  if (!isAxiosError(e)) return false;
  const data = e.response?.data;
  return typeof data === "string" && data.startsWith(`Cannot ${method}`);
}

function pickErrMsg(e: unknown): string {
  if (isAxiosError(e)) {
    const d = e.response?.data as unknown;
    if (typeof d === "string") return d;
    if (d && typeof (d as { message?: unknown }).message === "string") return (d as { message: string }).message;
  }
  if (e instanceof Error) return e.message;
  return "Bir hata oluştu.";
}

/* 3sn auto-hide toast */
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
      ? "bg-emerald-600/90 border-emerald-300/50"
      : "bg-rose-600/90 border-rose-300/50";
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [msg, kind, onClose]);
  return (
    <div
      className={`pointer-events-auto fixed right-3 z-[60] rounded-lg border px-3 py-[9px] text-sm text-white shadow ${tone}`}
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

/* ======== Confirm Modal ======== */
function ConfirmCloseModal({
  open,
  row,
  market,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  row: OrderRow | null;
  market: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open || !row) return null;

  const cs = guessContractSize(row.symbol);
  const px = market ?? row.entry;
  const pnl = (row.side === "BUY" ? px - row.entry : row.entry - px) * cs * row.qty;
  const pnlPct = row.entry ? ((px - row.entry) / row.entry) * (row.side === "BUY" ? 100 : -100) : 0;
  const sideCls = row.side === "BUY" ? "text-emerald-400" : "text-rose-400";
  const pnlCls  = pnl > 0 ? "text-emerald-300" : pnl < 0 ? "text-rose-300" : "text-yellow-300";

  const sideTr = row.side === "BUY" ? "UZUN" : "KISA";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60">
      <div className="w-[520px] max-w-[92vw] rounded-xl border border-white/10 bg-[#0E2E51] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">
            Pozisyonu Kapat - {row.symbol}
          </h3>
          <button
            onClick={onCancel}
            className="grid h-7 w-7 place-items-center rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-white/20"
            aria-label="Kapat"
            title="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-300 mb-3">
            Bu pozisyonu kapatmak istediğinize emin misiniz?
          </p>

          <div className="rounded-lg border border-white/10 bg-[#0B2540] px-3 py-2.5">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-slate-400">Yön</div>
              <div className={`text-right font-medium ${sideCls}`}>{sideTr}</div>

              <div className="text-slate-400">Giriş Fiyatı</div>
              <div className="text-right tabular-nums">
                {fmtNum(row.entry)} <span className="opacity-70">USD</span>
              </div>

              <div className="text-slate-400">Piyasa Fiyatı</div>
              <div className="text-right tabular-nums">
                {fmtNum(px)} <span className="opacity-70">USD</span>
              </div>

              <div className="text-slate-400">Teminat</div>
              <div className="text-right tabular-nums">
                {fmt2(row.margin ?? null)} <span className="opacity-70">USD</span>
              </div>

              <div className="col-span-2 border-t border-white/10 my-1" />

              <div className="text-slate-400">Kar/Zarar</div>
              <div className={`text-right tabular-nums font-semibold ${pnlCls}`}>
                {fmtSigned(pnl)} <span className="opacity-70">USD</span>
                <span className="ml-1 opacity-70">({nf2.format(Math.abs(pnlPct))}%)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          <button
            onClick={onCancel}
            className="rounded-md bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
          >
            Vazgeç
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-rose-500/70 hover:bg-rose-500 px-3 py-1.5 text-sm text-white"
          >
            Pozisyonu Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======== Tek satır render ======== */
function OrderRowView({
  r,
  onRowClick,
  onClose,
  askConfirm,
}: {
  r: OrderRow;
  onRowClick?: (row: OrderRow) => void;
  onClose: (id: string, marketForClose?: number | null) => void;
  askConfirm: (row: OrderRow, market: number | null) => void;
}) {
  const backendKey = r.symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const { price: live } = useInstrumentPrice(r.symbol, backendKey);
  const market = live ?? r.market ?? null;

  const cs  = guessContractSize(r.symbol);
  const pnl = market == null ? null : (r.side === "BUY" ? market - r.entry : r.entry - market) * cs * r.qty;
  const pnlCls = pnl == null ? "text-slate-300" : pnl > 0 ? "text-emerald-300" : pnl < 0 ? "text-rose-300" : "text-yellow-300";

  const autoClosing = useRef(false);
  useEffect(() => {
    if (autoClosing.current || r.status !== "OPEN" || market == null) return;
    const hitTp = r.tp != null && (r.side === "BUY" ? market >= r.tp : market <= r.tp);
    const hitSl = r.sl != null && (r.side === "BUY" ? market <= r.sl : market >= r.sl);
    if (hitTp || hitSl) {
      autoClosing.current = true;
      onClose(r.id, market);
    }
  }, [market, r, onClose]);

  return (
    <div
      className="grid grid-cols-11 w-full border-t border-white/10 hover:bg-white/5 cursor-default"
      onClick={onRowClick ? () => onRowClick(r) : undefined}
      role={onRowClick ? "button" : undefined}
      tabIndex={onRowClick ? 0 : -1}
    >
      <div className="px-3 py-2 text-center">{r.ts}</div>
      <div className="px-3 py-2 text-center">{r.symbol}</div>
      <div className={`px-3 py-2 text-center ${r.side === "BUY" ? "text-emerald-300" : "text-rose-300"}`}>
        {r.side === "BUY" ? "Uzun" : "Kısa"}
      </div>
      <div className="px-3 py-2 tabular-nums text-center">{fmtNum(r.entry)}</div>
      <div className="px-3 py-2 tabular-nums text-center">{fmtNum(market)}</div>
      <div className="px-3 py-2 tabular-nums text-center">
        {fmtNum(r.qty)} <span className="text-white">LOT</span>
      </div>
      <div className="px-3 py-2 tabular-nums text-center">{fmt2(r.margin ?? null)}</div>
      <div className={`px-3 py-2 tabular-nums font-medium text-center ${pnlCls}`}>{fmtSigned(pnl)}</div>
      <div className="px-3 py-2 text-center">
        {r.tp || r.sl ? `${fmtNum(r.tp ?? null)} / ${fmtNum(r.sl ?? null)}` : "—"}
      </div>
      <div className="px-3 py-2 text-center">{statusTr(r.status)}</div>
      <div className="px-3 py-2 text-center">
        {r.status === "OPEN" ? (
          <button
            onClick={(e) => { e.stopPropagation(); askConfirm(r, market); }}
            className="mx-auto grid h-5 w-5 place-items-center rounded-full bg-rose-500/70 hover:bg-rose-500 text-white shadow"
            title="Emri Kapat"
            aria-label="Emri Kapat"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </div>
    </div>
  );
}

/* ======== Ana Grid ======== */
export default function OrdersGrid({
  status = "OPEN",
  pageSize = DEFAULT_PAGE_SIZE,
  data,
  onRowClick,
  active,        // <— eklendi
  reloadToken,   // <— eklendi
}: Props) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<{ kind: "error" | "success"; msg: string } | null>(null);
  const lastErrorKeyRef = useRef<string | null>(null);
  const showErr = (msg: string) => {
    const key = `err:${msg}`;
    if (lastErrorKeyRef.current === key) return;
    lastErrorKeyRef.current = key;
    setToast({ kind: "error", msg });
  };
  const showOk = (msg: string) => { lastErrorKeyRef.current = null; setToast({ kind: "success", msg }); };

  const [confirm, setConfirm] = useState<{ row: OrderRow; market: number | null } | null>(null);

  const useApi          = !data;
  const stopPollingRef  = useRef(false);
  const pollTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoadRef    = useRef(true);

  const PRIMARY = "/api/orders";
  const ALT     = "/orders";

  function mapOrder(o: RawOrder): OrderRow {
    return {
      id: o.id,
      ts: o.openedAtText ?? o.openedAt ?? "",
      symbol: o.instrument?.display ?? o.instrument?.key ?? o.symbol ?? "-",
      side: o.side,
      entry: Number(o.entryPrice),
      market: o.livePrice != null ? Number(o.livePrice) : null,
      qty: Number(o.qtyLot ?? o.qty ?? 0),
      margin: o.marginUsd != null ? Number(o.marginUsd) : null,
      tp: o.tpPrice != null ? Number(o.tpPrice) : null,
      sl: o.slPrice != null ? Number(o.slPrice) : null,
      status: o.status,
    };
  }

  async function fetchOnce(urlBase: string) {
    const q = status === "ALL" ? "" : `?status=${encodeURIComponent(status)}`;
    const { data: res } = await http.get<OrdersResp>(`${urlBase}${q}`);
    const mapped = (res?.orders ?? []).map(mapOrder);
    setRows((prev) => (rowsChanged(prev, mapped) ? mapped : prev));
    lastErrorKeyRef.current = null;
  }

  async function fetchOrders() {
    if (!useApi || stopPollingRef.current) return;
    try {
      if (firstLoadRef.current) setLoading(true);
      await fetchOnce(PRIMARY);
    } catch (e1: unknown) {
      const s1 = getHttpStatus(e1);
      if (s1 === 404 || respStartsWithCannot(e1, "GET")) {
        try {
          await fetchOnce(ALT);
        } catch (e2: unknown) {
          const s2 = getHttpStatus(e2);
          showErr(pickErrMsg(e2));
          if (s2 === 404 || respStartsWithCannot(e2, "GET")) stopPollingRef.current = true;
        }
      } else {
        showErr(pickErrMsg(e1));
      }
    } finally {
      if (firstLoadRef.current) { setLoading(false); firstLoadRef.current = false; }
      if (!stopPollingRef.current) {
        pollTimerRef.current = setTimeout(fetchOrders, 5000);
      }
    }
  }

  // İlk mount + status değişimi
  useEffect(() => {
    if (useApi) {
      // active === false ise otomatik başlamasın
      stopPollingRef.current = active === false;
      firstLoadRef.current = true;
      if (active !== false) fetchOrders();
      const h = () => fetchOrders();
      window.addEventListener("orders:refresh", h);
      return () => {
        stopPollingRef.current = true;
        if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
        window.removeEventListener("orders:refresh", h);
      };
    } else {
      setRows(data!);
      return () => {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, useApi]);

  // Sekme görünürlüğü değiştiğinde polling’i durdur/başlat
  useEffect(() => {
    if (!useApi) return;
    if (active === false) {
      stopPollingRef.current = true;
      if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    } else if (active) {
      stopPollingRef.current = false;
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Dış tetik (ör. buton) – sadece aktifken
  useEffect(() => {
    if (!useApi || !active) return;
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const source = rows;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(source.length / pageSize)), [source.length, pageSize]);
  const [page, setPage] = useState(0);
  useEffect(() => { const maxPage = totalPages - 1; setPage((p) => (p > maxPage ? maxPage : p)); }, [totalPages]);

  const start = page * pageSize;
  const view  = useMemo(() => source.slice(start, start + pageSize), [source, start, pageSize]);

  async function handleClose(id: string, marketForClose?: number | null) {
    async function postClose(base: string) {
      await http.post(`${base}/${id}/close`, { price: marketForClose });
    }
    try {
      try {
        await postClose(PRIMARY);
      } catch (e1: unknown) {
        const s1 = getHttpStatus(e1);
        if (s1 === 404 || respStartsWithCannot(e1, "POST")) {
          await postClose(ALT);
        } else {
          throw e1;
        }
      }
      showOk("Pozisyon başarıyla kapatıldı.");
      fetchOrders();
      try { window.dispatchEvent(new CustomEvent("history:refresh")); } catch {}
    } catch (e: unknown) {
      showErr(pickErrMsg(e));
    }
  }

  return (
    <div className="w-full relative" style={{ overflowAnchor: "none" }}>
      {toast && <Toast kind={toast.kind} msg={toast.msg} onClose={() => setToast(null)} />}

      <div className="w-full text-sm min-h-[220px]">
        {!loading && view.length === 0 && (
          <div className="w-full border-t border-white/10">
            <div className="relative h-full min-h-[220px]">
              <div className="absolute inset-0 grid place-items-center px-3 text-sm text-slate-400 text-center">
                Açık emir bulunmamaktadır.
              </div>
            </div>
          </div>
        )}

        {view.map((r) => (
          <OrderRowView
            key={r.id}
            r={r}
            onRowClick={onRowClick}
            onClose={handleClose}
            askConfirm={(row, market) => setConfirm({ row, market })}
          />
        ))}
      </div>

      <div className="w-full flex items-center justify-between border-t border-white/10 px-2 py-2 text-xs text-slate-300 bg-[#0E2E51]">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || rows.length === 0}
          className="rounded bg-white/10 px-3 py-1 disabled:opacity-40"
          aria-disabled={page === 0 || rows.length === 0}
        >
          ← Önceki
        </button>
        <span>Sayfa {Math.min(page + 1, totalPages)} / {totalPages}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1 || rows.length === 0}
          className="rounded bg-white/10 px-3 py-1 disabled:opacity-40"
          aria-disabled={page >= totalPages - 1 || rows.length === 0}
        >
          Sonraki →
        </button>
      </div>

      <ConfirmCloseModal
        open={!!confirm}
        row={confirm?.row ?? null}
        market={confirm?.market ?? null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) handleClose(confirm.row.id, confirm.market);
          setConfirm(null);
        }}
      />
    </div>
  );
}
