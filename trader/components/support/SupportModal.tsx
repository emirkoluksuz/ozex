"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function SupportModal({
  open,
  onClose,
  onSubmit,
  onHistory,      // eski isim (destekli)
  onOpenHistory,  // yeni isim (destekli)
}: {
  open: boolean;
  onClose: () => void;
  onSubmit?: (payload: { subject: string; message: string }) => void;
  onHistory?: () => void;
  onOpenHistory?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleHistory = onOpenHistory ?? onHistory;

  useEffect(() => setMounted(true), []);

  // Reset + body scroll lock
  useEffect(() => {
    if (!open) return;
    setSubject("");
    setMessage("");

    const prevB = document.body.style.overflow;
    const prevH = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevB;
      document.documentElement.style.overflow = prevH;
    };
  }, [open]);

  // Odak yönetimi (Escape ile kapatma YOK)
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    // Açılışta kapat butonuna odak
    closeBtnRef.current?.focus?.();

    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;

  const valid = subject.trim().length > 0 && message.trim().length > 0;

  const dialog = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop — arka plana tıklayınca KAPANMAZ */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        className="relative w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0E2E51] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="support-modal-title" className="text-lg font-semibold text-white">
            Destek Talebi
          </h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Kapat"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/40 bg-rose-600/30 text-rose-200 hover:bg-rose-600/40 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Konu */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">Konu</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Konu başlığını yazınız."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60"
            />
          </div>

          {/* Mesaj */}
          <div>
            <label className="mb-2 block text-sm text-slate-300">Mesajınız</label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Soru veya sorununuzu detaylı olarak yazınız..."
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          {/* Geçmiş talepler */}
          <button
            type="button"
            onClick={() => handleHistory?.()}
            className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/20"
          >
            Geçmiş talepler
          </button>

          {/* Aksiyonlar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}  // ✅ Vazgeç kapatır
              className="rounded-md bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/20"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                if (!valid) return;
                onSubmit?.({ subject: subject.trim(), message: message.trim() });
                onClose();
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                valid
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-emerald-600/50 text-white/70 cursor-not-allowed"
              }`}
            >
              Gönder
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
