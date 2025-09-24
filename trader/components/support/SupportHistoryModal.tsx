"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type TicketStatus = "Açık" | "Yanıtlandı" | "Kapalı" | "Beklemede";

export interface SupportTicket {
  id: string | number;
  subject: string;
  status: TicketStatus;
  createdAt?: string | number | Date;
}

export default function SupportHistoryModal({
  open,
  onClose,
  onBack, // ← sol alttaki "Geri" için
  tickets = [],
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  tickets?: SupportTicket[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevB = document.body.style.overflow;
    const prevH = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevB;
      document.documentElement.style.overflow = prevH;
    };
  }, [open]);

  const sorted = useMemo(() => {
    return [...tickets].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [tickets]);

  if (!open || !mounted) return null;

  const dialog = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop – tıklayınca kapanmaz */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-history-title"
        className="relative w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0E2E51] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="support-history-title" className="text-lg font-semibold text-white">
            Geçmiş Talepler
          </h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/40 bg-rose-600/30 text-rose-200 hover:bg-rose-600/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-slate-300">
              Kayıtlı talep bulunmuyor.
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {sorted.map((t) => (
                <li key={t.id} className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">
                        {t.subject}
                      </div>
                      {t.createdAt && (
                        <div className="mt-1 text-[11px] text-slate-400">
                          {formatDate(t.createdAt)}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer – sol altta Geri */}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : onClose())}
            className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/20"
          >
            ← Geri
          </button>
          <div />{/* sağ taraf boş */}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

/* ---- Helpers ---- */
function StatusBadge({ status }: { status: TicketStatus }) {
  const styles =
    status === "Açık"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
      : status === "Yanıtlandı"
      ? "bg-sky-500/15 text-sky-300 border-sky-400/30"
      : status === "Beklemede"
      ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
      : "bg-rose-500/15 text-rose-300 border-rose-400/30"; // Kapalı

  return (
    <span className={`flex-none rounded-full border px-2 py-0.5 text-[11px] ${styles}`}>
      {status}
    </span>
  );
}

function formatDate(d: string | number | Date) {
  try {
    const dt = new Date(d);
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(dt);
  } catch {
    return "";
  }
}
