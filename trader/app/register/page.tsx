"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import BrandHeader from "@/components/auth/BrandHeader";
import { Btn } from "@/components/auth/Btn";
import { AtSign, Phone, Lock, User, Eye, EyeOff, Check, X } from "lucide-react";
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

function getErrMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Kayıt başarısız. Bilgileri kontrol edin.";
}

export default function RegisterPage() {
  const r = useRouter();
  const { user, loading, register } = useAuth();

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

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [ref, setRef] = useState(""); // sadece UI
  const [show, setShow] = useState(false);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) r.replace("/");
  }, [loading, user, r]);

  const nameRegex = /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/u;
  const isValidEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
  const isValidPhone = (v: string) => /^05\d{9}$/.test(v);
  const usernameRegex = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9\p{P}]{3,32}$/u;
  const isValidUsername = (v: string) => usernameRegex.test(v);
  const isValidPassword = (v: string) =>
    /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && v.length >= 6;

  const criteria = useMemo(
    () => ({
      length: pwd.length >= 6,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
    }),
    [pwd],
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setErr(null);

    const tFirst = first.trim();
    const tLast = last.trim();
    const tUser = username.trim();
    const tPhone = phone.trim();
    const tEmail = email.trim();
    const tPwd = pwd;

    if (!tFirst || !tLast || !tUser || !tPhone || !tEmail || !tPwd) {
      setErr("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }
    if (!nameRegex.test(tFirst)) {
      setErr("Ad sadece harf ve boşluktan oluşmalıdır.");
      return;
    }
    if (!nameRegex.test(tLast)) {
      setErr("Soyad sadece harf ve boşluktan oluşmalıdır.");
      return;
    }
    if (!isValidUsername(tUser)) {
      setErr("Kullanıcı adı 3-32 karakter olmalı; boşluk içeremez.");
      return;
    }
    if (!isValidPhone(tPhone)) {
      setErr("Telefon numarası 05XXXXXXXXX formatında olmalıdır.");
      return;
    }
    if (!isValidEmail(tEmail)) {
      setErr("Geçerli bir e-posta adresi giriniz.");
      return;
    }
    if (!isValidPassword(tPwd)) {
      setErr("Şifre 1 küçük, 1 büyük harf ve 1 sayı içermeli; en az 6 karakter olmalı.");
      return;
    }
    if (!accept) {
      setErr("Kullanım sözleşmesini kabul etmelisiniz.");
      return;
    }

    try {
      setBusy(true);
      await register({
        firstName: tFirst,
        lastName: tLast,
        phone: tPhone,
        email: tEmail,
        username: tUser,
        password: tPwd,
      });
      r.replace(next);
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard>
      <BrandHeader subtitle="Yatırımcı Kayıt Paneli" />

      <form noValidate onSubmit={onSubmit} className="px-8 py-6 space-y-4">
        {/* Ad / Soyad */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ad *</Label>
            <InputShell>
              <span className="pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </span>
              <input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="Ad"
                className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-slate-400"
                pattern="[A-Za-zÇĞİÖŞÜçğıöşü\s]+"
                inputMode="text"
                autoComplete="given-name"
                disabled={busy}
              />
            </InputShell>
          </div>
          <div>
            <Label>Soyad *</Label>
            <InputShell>
              <input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder="Soyad"
                className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
                pattern="[A-Za-zÇĞİÖŞÜçğıöşü\s]+"
                inputMode="text"
                autoComplete="family-name"
                disabled={busy}
              />
            </InputShell>
          </div>
        </div>

        {/* Kullanıcı Adı */}
        <div>
          <Label>Kullanıcı Adı *</Label>
          <InputShell>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ornekozex2025"
              className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
              autoComplete="username"
              disabled={busy}
            />
          </InputShell>
        </div>

        {/* Telefon */}
        <div>
          <Label>Telefon Numarası *</Label>
          <InputShell>
            <span className="pl-3 text-slate-400">
              <Phone className="h-4 w-4" />
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XXXXXXXXX"
              className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-slate-400"
              inputMode="numeric"
              autoComplete="tel"
              disabled={busy}
            />
          </InputShell>
        </div>

        {/* E-posta */}
        <div>
          <Label>E-Posta Adresi *</Label>
          <InputShell>
            <span className="pl-3 text-slate-400">
              <AtSign className="h-4 w-4" />
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@ozex.com"
              type="email"
              className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-slate-400"
              autoComplete="email"
              disabled={busy}
            />
          </InputShell>
        </div>

        {/* Şifre */}
        <div>
          <Label>Şifre *</Label>
          <InputShell>
            <span className="pl-3 text-slate-400">
              <Lock className="h-4 w-4" />
            </span>
            <input
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••••"
              type={show ? "text" : "password"}
              className="w-full bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-slate-400"
              autoComplete="new-password"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="px-3 text-slate-300 hover:text-slate-100"
              disabled={busy}
              aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </InputShell>

          {pwd.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              <li className="flex items-center gap-2">
                {criteria.length ? <Check className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-rose-400" />}
                <span className={criteria.length ? "text-emerald-400" : "text-rose-400"}>En az 6 karakter</span>
              </li>
              <li className="flex items-center gap-2">
                {criteria.upper ? <Check className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-rose-400" />}
                <span className={criteria.upper ? "text-emerald-400" : "text-rose-400"}>En az bir büyük harf</span>
              </li>
              <li className="flex items-center gap-2">
                {criteria.lower ? <Check className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-rose-400" />}
                <span className={criteria.lower ? "text-emerald-400" : "text-rose-400"}>En az bir küçük harf</span>
              </li>
              <li className="flex items-center gap-2">
                {criteria.number ? <Check className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-rose-400" />}
                <span className={criteria.number ? "text-emerald-400" : "text-rose-400"}>En az bir sayı</span>
              </li>
            </ul>
          )}
        </div>

        {/* Referans Kodu */}
        <div>
          <Label>Referans Kodu (Opsiyonel)</Label>
          <InputShell>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Varsa referans kodunuz"
              className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
              disabled={busy}
            />
          </InputShell>
        </div>

        {/* Kullanım sözleşmesi */}
        <label className="flex items-center gap-3 text-xs text-slate-300">
          <button
            type="button"
            onClick={() => setAccept((v) => !v)}
            className={`h-5 w-9 rounded-full transition-colors ${accept ? "bg-emerald-500" : "bg-slate-500/50"}`}
            disabled={busy}
            aria-pressed={accept}
          >
            <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${accept ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span>
            <a href="#" className="text-orange-400 hover:underline underline-offset-4">Kullanım sözleşmesini</a> okudum ve kabul ediyorum.
          </span>
        </label>

        {err && (
          <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
            {err}
          </div>
        )}

        <Btn disabled={busy}>
          {busy ? "Kayıt olunuyor" : "Kayıt Ol"}
        </Btn>

        <div className="pt-1 text-center text-sm">
          <span className="text-slate-300">Zaten bir hesabınız var mı? </span>
          <Link href="/login" className="text-orange-400 hover:underline underline-offset-4">Giriş Yap</Link>
        </div>
      </form>
    </AuthCard>
  );
}
