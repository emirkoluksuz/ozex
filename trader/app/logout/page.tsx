"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function getErrMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Çıkış sırasında bir sorun oluştu. Yine de oturumunuz sonlandırıldı.";
}

function LogoutInner() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next") || "/";
  const next = useMemo(() => (typeof nextParam === "string" ? nextParam : "/"), [nextParam]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Kullanıcı yoksa login'e yönlendir (next ile)
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, next]);

  // Unmount'ta olası isteği iptal et
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const clearLocalAuthState = () => {
    try {
      if (typeof window === "undefined") return;
      const ns = localStorage.getItem("auth_user_ns");
      if (ns) localStorage.removeItem(`ml_fav_v1:${ns}`);

      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("ml_fav_v1:")) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));

      localStorage.removeItem("auth_user_ns");
      window.dispatchEvent(new Event("auth_user_ns_changed"));
    } catch {
      /* no-op */
    }
  };

  const onConfirm = async () => {
    if (busy) return;
    setErr(null);
    setBusy(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await logout({ signal: ac.signal }); // withCredentials içeride set
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
      clearLocalAuthState();
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  };

  const onCancel = () => router.replace(next || "/");

  if (loading || !user) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0B2540] text-slate-100">
        <div className="rounded-lg border border-white/10 bg-[#0E2E51] px-4 py-2 text-sm">
          Yükleniyor…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-[#0B2540] text-slate-100">
      <div className="w-[360px] rounded-lg border border-white/10 bg-[#0E2E51] p-6">
        <h1 className="text-lg font-semibold mb-2">Oturumu Kapat</h1>
        <p className="text-sm text-slate-300 mb-4">Çıkış yapmak istediğinizden emin misiniz?</p>

        {err && (
          <div className="mb-3 rounded border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
            {err}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="flex-1 rounded bg-rose-600 hover:bg-rose-500 px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Çıkış yapılıyor…" : "Çıkış Yap"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded bg-white/10 hover:bg-white/20 px-3 py-2 text-sm disabled:opacity-50"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh grid place-items-center bg-[#0B2540] text-slate-100">
          <div className="rounded-lg border border-white/10 bg-[#0E2E51] px-4 py-2 text-sm">
            Yükleniyor…
          </div>
        </div>
      }
    >
      <LogoutInner />
    </Suspense>
  );
}
