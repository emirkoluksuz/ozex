// app/login/page.tsx
"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import BrandHeader from "@/components/auth/BrandHeader";
import { Btn } from "@/components/auth/Btn";
import { AtSign, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function InputShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-[#0B2540] ring-1 ring-transparent focus-within:ring-emerald-400/40">
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-300 mb-1">{children}</div>;
}

// Sunucudan gelen hata mesajını güvenli çıkar (any kullanmadan)
function getApiMessage(err: unknown): string | null {
  if (typeof err === "object" && err !== null) {
    const maybe = err as { response?: { data?: { message?: unknown } } };
    const msg = maybe.response?.data?.message;
    if (typeof msg === "string") return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return null;
}

export default function LoginPage() {
  const r = useRouter();
  const { user, loading, login } = useAuth();

  // Suspense kullanmadan next paramını oku
  const [nextParam, setNextParam] = useState<string>("/");
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = sp.get("next") || "/";
      setNextParam(raw);
    } catch {
      setNextParam("/");
    }
  }, []);

  const next = useMemo(() => {
    const n = typeof nextParam === "string" ? nextParam : "/";
    if (!n.startsWith("/")) return "/";
    if (n === "/login" || n.startsWith("/login?")) return "/";
    return n;
  }, [nextParam]);

  const [identifier, setIdentifier] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Giriş olduysa yönlendir
  useEffect(() => {
    if (!loading && user) {
      try {
        const ns = user.id || user.email || user.username || "anon";
        localStorage.setItem("auth_user_ns", String(ns));
        window.dispatchEvent(new Event("auth_user_ns_changed"));
      } catch {}
      r.replace(next);
    }
  }, [loading, user, r, next]);

  const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr(null);

    const id = identifier.trim();
    const pwdTrim = pwd.trim();
    if (!id || !pwdTrim) {
      setErr("Giriş bilgilerinizi giriniz.");
      return;
    }
    if (id.includes("@") && !isEmail(id)) {
      setErr("Geçerli bir e-posta adresi giriniz.");
      return;
    }

    try {
      setBusy(true);
      try {
        localStorage.setItem("auth_user_ns", `pending:${id}`);
        window.dispatchEvent(new Event("auth_user_ns_changed"));
      } catch {}
      // login yalnızca 2 argüman alıyor
      await login(id, pwdTrim);

      // "Beni Hatırla" client-side cookie ile yönetiliyor
      try {
        if (remember) {
          // 30 gün geçerli, sadece client için
          document.cookie = `remember=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        } else {
          document.cookie = "remember=; path=/; Max-Age=0; SameSite=Lax";
        }
      } catch {}
      // yönlendirme effect içinde
    } catch (e: unknown) {
      const apiMsg =
        getApiMessage(e) || "Giriş başarısız. Bilgilerinizi kontrol edin.";
      setErr(apiMsg);
      try {
        localStorage.removeItem("auth_user_ns");
        window.dispatchEvent(new Event("auth_user_ns_changed"));
      } catch {}
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard>
      <BrandHeader subtitle="Yatırımcı Giriş Paneli" />

      <form noValidate onSubmit={onSubmit} className="px-8 py-6 space-y-4">
        <div>
          <Label>Kullanıcı Adı</Label>
          <InputShell>
            <span className="pl-3 text-slate-400">
              <AtSign className="h-4 w-4" />
            </span>
            <input
              autoFocus
              readOnly={busy}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ornekozex2025"
              type="text"
              autoComplete="username"
              className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-slate-400"
              disabled={busy}
              aria-invalid={!!err}
            />
          </InputShell>
        </div>

        <div>
          <Label>Şifre</Label>
          <InputShell>
            <span className="pl-3 text-slate-400">
              <Lock className="h-4 w-4" />
            </span>
            <input
              readOnly={busy}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••••"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-slate-400"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="px-3 text-slate-300 hover:text-slate-100"
              aria-label={show ? "Gizle" : "Göster"}
              title={show ? "Gizle" : "Göster"}
              disabled={busy}
            >
              {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </InputShell>
        </div>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setRemember((v) => !v)}
            className="flex items-center gap-2"
            disabled={busy}
            aria-pressed={remember}
          >
            <span
              className={`h-4 w-7 rounded-full transition-colors ${
                remember ? "bg-emerald-500" : "bg-slate-500/50"
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                  remember ? "translate-x-3" : "translate-x-0"
                }`}
              />
            </span>
            <span className="text-slate-300">Beni Hatırla</span>
          </button>

          <Link href="/forgot" className="text-slate-300 hover:underline underline-offset-4">
            Şifremi Unuttum
          </Link>
        </div>

        {err && (
          <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
            {err}
          </div>
        )}

        <Btn disabled={busy} aria-disabled={busy}>
          {busy ? "Giriş Yapılıyor…" : "Giriş Yap"}
        </Btn>

        <div className="pt-1 text-center text-sm">
          <span className="text-slate-300">Hesabınız yok mu? </span>
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="text-orange-400 hover:underline underline-offset-4"
          >
            Bir hesap oluşturun.
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
