"use client";
import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import BrandHeader from "@/components/auth/BrandHeader";
import { Btn } from "@/components/auth/Btn";
import { AtSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

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

export default function ForgotPage() {
  const { user, loading } = useAuth();
  const r = useRouter();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Girişliyse bu sayfayı gösterme → ana sayfaya al
  useEffect(() => {
    if (!loading && user) r.replace("/");
  }, [loading, user, r]);

  const isValidEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);

  // Şimdilik sadece UI simülasyonu (backend uçları devre dışı)
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    setErr(null);
    setDone(false);

    const t = email.trim();
    if (!t) {
      setErr("E-posta adresinizi girin.");
      return;
    }
    if (!isValidEmail(t)) {
      setErr("Geçerli bir e-posta girin.");
      return;
    }

    setBusy(true);
    setTimeout(() => {
      setDone(true);
      setBusy(false);
    }, 600);
  }

  return (
    <AuthCard>
      <BrandHeader subtitle="Şifremi Unuttum" />

      <form noValidate onSubmit={onSubmit} className="px-8 py-6 space-y-4">
        <p className="text-sm text-slate-300 text-center">
          Şifrenizi sıfırlamak için e-posta adresinizi giriniz.
        </p>

        <div>
          <Label>E-Posta</Label>
          <InputShell>
            <span className="pl-3 text-slate-400">
              <AtSign className="h-4 w-4" />
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@ozex.com"
              type="email"
              autoComplete="email"
              className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-slate-400"
              disabled={busy}
            />
          </InputShell>
        </div>

        {err && (
          <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
            {err}
          </div>
        )}

        <Btn disabled={busy} aria-disabled={busy}>
          {busy ? "Bağlantı Gönderiliyor" : "Şifremi Unuttum"}
        </Btn>

        {done && (
          <div className="text-xs text-emerald-300">
            Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi.
          </div>
        )}

        <div className="text-center text-sm">
          <Link href="/login" className="text-orange-400 hover:underline underline-offset-4">
            Giriş Yap
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
