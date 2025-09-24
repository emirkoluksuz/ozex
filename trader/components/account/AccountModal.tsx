"use client";
import { useMemo, useState } from "react";
import { X, User, Shield, IdCard, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AccountModal({ open, onClose }: Props) {
  const { user, loading } = useAuth();

  const [tab, setTab] = useState<"profile" | "security" | "kyc">("profile");

  // ---- Profile form state (UI only) ----
  const [firstName] = useState(""); // disabled alanlar
  const [lastName] = useState("");  // disabled alanlar
  const [phone] = useState("");     // disabled alanlar

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  // doldur
  useMemo(() => {
    if (loading || !user) return;
    setEmail(user.email ?? "");
    setUsername(user.username ?? "");
  }, [loading, user]);

  // ---- Security form state (UI only) ----
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [repeatPw, setRepeatPw] = useState("");
  // min 6, büyük, küçük, sayı
  const strong = (s: string) =>
    /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && s.length >= 6;

  // ---- Submit stubs (BAĞLANACAK) ----
  const saveProfile = async () => {
    // TODO: /api/account/profile (PUT)
    // body: { email, username }
  };

  const changePassword = async () => {
    if (newPw !== repeatPw) {
      alert("Yeni şifre ve tekrar aynı olmalı.");
      return;
    }
    if (!strong(newPw)) {
      alert("Şifre en az 6 karakter, bir büyük, bir küçük harf ve sayı içermeli.");
      return;
    }
    // TODO: /api/account/password (POST)
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50">
      <div className="relative w-[820px] max-w-[95vw] overflow-hidden rounded-2xl border border-white/10 bg-[#0E2E51] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-white/10">
              <User className="h-4 w-4 text-slate-200" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Hesabım</div>
              <div className="text-xs text-slate-400">
                {loading ? "Yükleniyor…" : `${user?.firstName} ${user?.lastName} • ${user?.email}`}
              </div>
            </div>
          </div>

          {/* Kırmızı kapatma (SupportHistoryModal ile aynı) */}
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/40 bg-rose-600/30 text-rose-200 hover:bg-rose-600/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setTab("profile")}
              className={`rounded-md px-3 py-2 ${tab === "profile" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"}`}
            >
              Profil
            </button>
            <button
              onClick={() => setTab("security")}
              className={`rounded-md px-3 py-2 ${tab === "security" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"}`}
            >
              Güvenlik
            </button>
            <button
              onClick={() => setTab("kyc")}
              className={`rounded-md px-3 py-2 ${tab === "kyc" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"}`}
            >
              Doğrulama
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* --- PROFIL --- */}
          {tab === "profile" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-300">Ad</label>
                <input
                  value={user?.firstName ?? firstName}
                  placeholder="Adınız"
                  disabled
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-slate-300"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300">Soyad</label>
                <input
                  value={user?.lastName ?? lastName}
                  placeholder="Soyadınız"
                  disabled
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-slate-300"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300">E-posta</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@ozex.com"
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-white placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300">Kullanıcı Adı</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ornekozex2025"
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-white placeholder:text-slate-400"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-300">Telefon</label>
                <input
                  value={user?.phone ?? phone}
                  placeholder="05XXXXXXXXX"
                  disabled
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-slate-300"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
                >
                  Vazgeç
                </button>
                <button
                  onClick={saveProfile}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          )}

          {/* --- GÜVENLIK (sadece şifre) --- */}
          {tab === "security" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-300" />
                <div className="text-sm font-medium text-white">Şifre Değiştir</div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="password"
                  placeholder="Mevcut Şifre"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-white placeholder:text-slate-400"
                />
                <input
                  type="password"
                  placeholder="Yeni Şifre"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-white placeholder:text-slate-400"
                />
                <input
                  type="password"
                  placeholder="Yeni Şifre (Tekrar)"
                  value={repeatPw}
                  onChange={(e) => setRepeatPw(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#0B2540] px-3 py-2 text-sm text-white placeholder:text-slate-400"
                />
              </div>

              <div className="text-xs leading-relaxed text-slate-300">
                Güvenliğiniz için şifrenizi düzenli olarak güncelleyiniz. Minimum 6 karakter, büyük harf,
                küçük harf ve sayı içeren güçlü bir şifre kullanmanız hesap güvenliğinizi artırır.
              </div>

              <div className="flex justify-end">
                <button
                  onClick={changePassword}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500"
                >
                  Şifreyi Güncelle
                </button>
              </div>
            </div>
          )}

          {/* --- DOĞRULAMA (KYC UI) --- */}
          {tab === "kyc" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-sky-300" />
                <div className="text-sm font-medium text-white">Kimlik Doğrulama</div>
              </div>

              <p className="text-sm leading-relaxed text-slate-200">
                Platformumuzu güvenli ve yasal mevzuata uyumlu tutmak için kullanıcılarımızdan kimlik doğrulaması talep ediyoruz.
                Bu süreç; dolandırıcılık girişimlerinin engellenmesi, kara para aklama ve terörizmin finansmanı ile mücadele kapsamında
                gerekli kontrollerin yapılması, hesap sahipliğinin doğrulanması ve işlemlerinizin güvence altına alınması gibi
                kritik amaçlara hizmet eder.
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UploadCard label="Kimlik Ön Yüz" accept="image/*,.pdf" />
                <UploadCard label="Kimlik Arka Yüz" accept="image/*,.pdf" />
                <UploadCard label="Öz Çekim (Selfie)" accept="image/*" />
                {/* Adres: uyarı dosya alanının ALTINDA */}
                <UploadCard label="Adres" accept="image/*,.pdf" hint="İkamet belgesi veya fatura eklenmelidir." hintBelow />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500"
                  // TODO: Gönder (backend'e bağlanacak)
                >
                  Belgeleri Gönder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- UploadCard: adres için uyarıyı dosya alanının altında gösterebilir --- */
function UploadCard({
  label,
  accept,
  hint,
  hintBelow = false,
}: {
  label: string;
  accept?: string;
  hint?: string;
  hintBelow?: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-white/10 bg-[#0B2540] p-4">
      <div className="text-xs font-medium text-slate-200">{label}</div>

      {/* Dosya alanı */}
      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-md border border-dashed border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
        <span className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {fileName ?? "Dosya seçin"}
        </span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <span className="text-xs text-slate-300">Gözat</span>
      </label>

      {/* Uyarı metni (adres için aşağıda) */}
      {hint && hintBelow && (
        <div className="mt-2 text-[11px] leading-relaxed text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}
