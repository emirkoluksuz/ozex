// src/components/Header.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bell, TrendingUp, ArrowDownCircle, HelpCircle, User, LogOut, ShieldCheck } from "lucide-react";
import DepositModal from "@/components/money/DepositModal";
import WithdrawModal from "@/components/money/WithdrawModal";
import SupportModal from "@/components/support/SupportModal";
import SupportHistoryModal from "@/components/support/SupportHistoryModal";
import AccountModal from "@/components/account/AccountModal";
import { useAuth } from "@/contexts/AuthContext";
import { http } from "@/lib/http";

/** Ortak USD formatı: 1,234.56 */
const nf2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Gelebilecek string sayıları güvenli şekilde number’a çevirir */
function toNumberLoose(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, "")); // 1,234.56
  if (/^\d+,\d+$/.test(s)) return Number(s.replace(",", "."));                  // 1234,56
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatUsd(value: number | string | null | undefined) {
  const n = toNumberLoose(value);
  return `${nf2.format(n)} USD`;
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportHistoryModalOpen, setSupportHistoryModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const notifTriggerRef = useRef<HTMLButtonElement | null>(null);
  const notifDropdownRef = useRef<HTMLDivElement | null>(null);
  const [triggerSize, setTriggerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const next = `${pathname}${sp?.toString() ? `?${sp.toString()}` : ""}`;

  const { user } = useAuth(); // loading'i UI'da kullanmıyoruz

  // 🔢 Bakiye — number olarak tut (formatı render’da uygula)
  const [balance, setBalance] = useState<number>(0);

  const reloadBalance = async () => {
    try {
      const { data } = await http.get<{ balance?: string | number; balanceUSD?: number }>("/api/wallet/balance");
      const val = toNumberLoose(data?.balanceUSD ?? data?.balance);
      setBalance(val);
    } catch {
      // yut
    }
  };

  // Trigger ölçümü
  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => setTriggerSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // dış tıklama kapat
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      const clickedProfile =
        (dropdownRef.current && dropdownRef.current.contains(t)) ||
        (triggerRef.current && triggerRef.current.contains(t));
      const clickedNotif =
        (notifDropdownRef.current && notifDropdownRef.current.contains(t)) ||
        (notifTriggerRef.current && notifTriggerRef.current.contains(t));
      if (!clickedProfile) setOpen(false);
      if (!clickedNotif) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ✅ Bakiye: 5 sn'de bir çek — sadece user varken
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadBalance = async () => {
      try {
        const { data } = await http.get<{ balance?: string | number; balanceUSD?: number }>("/api/wallet/balance", {
          withCredentials: true,
        });
        if (cancelled) return;
        const val = toNumberLoose(data?.balanceUSD ?? data?.balance);
        setBalance(val);
      } catch {
        // yut
      }
    };

    loadBalance();
    const timerId = window.setInterval(loadBalance, 5000);
    return () => {
      cancelled = true;
      clearInterval(timerId);
    };
  }, [user]);

  const menu = [
    { label: "Al/Sat", icon: <TrendingUp className="h-4 w-4" />, onClick: () => router.push("/") },
    { label: "Para Yatır", icon: <ArrowDownCircle className="h-4 w-4" />, onClick: () => setDepositModalOpen(true) },
    { label: "Para Çek", icon: <ArrowDownCircle className="h-4 w-4 rotate-180" />, onClick: () => setWithdrawModalOpen(true) },
    { label: "Destek Talebi", icon: <HelpCircle className="h-4 w-4" />, onClick: () => setSupportModalOpen(true) },
  ] as const;

  const now = Date.now();
  const notifications = [
    { id: 5, title: "Fiyat Uyarısı", desc: "XAUUSD 3150 seviyesine yaklaştı.", time: "30 dk önce", ts: now - 30 * 60 * 1000 },
    { id: 4, title: "Emir Gerçekleşti", desc: "BTC/USDT 0.05 lot satış emriniz gerçekleşti.", time: "Şimdi", ts: now },
    { id: 1, title: "Emir Gerçekleşti", desc: "XAUUSD 0.20 lot alım emriniz kısmen gerçekleşti.", time: "2 dk önce", ts: now - 2 * 60 * 1000 },
    { id: 2, title: "Para Yatırma", desc: "USDT yatırma talebiniz alındı.", time: "1 saat önce", ts: now - 60 * 60 * 1000 },
    { id: 3, title: "Güvenlik Uyarısı", desc: "Yeni cihazdan giriş yapıldı.", time: "Dün", ts: now - 24 * 60 * 60 * 1000 },
  ];
  const latest = [...notifications].sort((a, b) => b.ts - a.ts).slice(0, 5);

  const accentFor = (title: string) => {
    if (/emir/i.test(title)) return { bg: "bg-emerald-500/10", br: "border-emerald-400/40", dot: "bg-emerald-400" };
    if (/para/i.test(title)) return { bg: "bg-sky-500/10", br: "border-sky-400/40", dot: "bg-sky-400" };
    if (/güvenlik|uyarı/i.test(title)) return { bg: "bg-amber-500/10", br: "border-amber-400/40", dot: "bg-amber-400" };
    if (/fiyat/i.test(title)) return { bg: "bg-indigo-500/10", br: "border-indigo-400/40", dot: "bg-indigo-400" };
    return { bg: "bg-white/5", br: "border-white/10", dot: "bg-slate-400" };
  };

  const fullName = user ? `${user.firstName} ${user.lastName}` : "—";
  const email = user?.email ?? "—";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A1F35]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1760px] items-center px-5 relative">
          <div className="flex items-center gap-2 pr-6">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-300 to-orange-600" />
            <div className="text-2xl font-bold tracking-tight">
              <span className="text-amber-300">OZEX</span> FINANCE
            </div>
          </div>

          <nav className="flex flex-1 justify-center gap-8 text-sm text-slate-300" aria-label="Ana menü">
            {menu.map((item) => (
              <button key={item.label} type="button" className="flex items-center gap-1 hover:text-white" onClick={item.onClick}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                ref={notifTriggerRef}
                aria-label="Bildirimler"
                aria-expanded={notifOpen}
                aria-haspopup="true"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setOpen(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-md bg-white/10 transition-colors hover:bg-white/20"
              >
                <Bell className="h-4 w-4" />
              </button>

              {notifOpen && (
                <div
                  ref={notifDropdownRef}
                  role="menu"
                  aria-label="Bildirim listesi"
                  className="absolute right-0 mt-2 w-[380px] min-h-[260px] overflow-hidden rounded-xl border border-white/10 bg-[#0E2E51] shadow-xl"
                  style={{ minHeight: Math.max(triggerSize.h, 260) }}
                >
                  <div className="px-4 py-3">
                    <div className="text-sm font-semibold text-white">Bildirimler</div>
                  </div>
                  <div className="border-t border-white/10" />
                  <ul className="max-h-[420px] overflow-auto py-2 text-sm">
                    {latest.map((n) => {
                      const a = accentFor(n.title);
                      return (
                        <li key={n.id} className={`mx-2 mb-2 rounded-md border px-3 py-2 ${a.bg} ${a.br} last:mb-0`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-1 h-2 w-2 flex-none rounded-full ${a.dot}`} />
                            <div className="min-w-0 grow">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate font-medium text-slate-100">{n.title}</span>
                                <span className="flex-none text-[10px] text-slate-400">{n.time}</span>
                              </div>
                              <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{n.desc}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {latest.length === 0 && (
                      <li className="px-4 py-10 text-center text-sm text-slate-300">Bildirim bulunmuyor.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                type="button"
                ref={triggerRef}
                aria-label="Profil menüsü"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => {
                  setOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                  <User className="h-4 w-4 text-slate-300" />
                </div>
                <div className="text-left">
                  <div className="text-xs">{fullName}</div>
                  <div className="text-[10px] text-emerald-400">{formatUsd(balance)}</div>
                </div>
              </button>

              {open && (
                <div
                  ref={dropdownRef}
                  role="menu"
                  aria-label="Profil menüsü"
                  className="absolute right-0 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0E2E51] shadow-xl"
                  style={{ width: Math.max(triggerSize.w, 320), minHeight: triggerSize.h }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{fullName}</div>
                      <div className="truncate text-xs text-slate-400">{email}</div>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                      <ShieldCheck className="h-3 w-3" /> Doğrulandı
                    </span>
                  </div>

                  {/* Balance */}
                  <div className="px-4">
                    <div className="rounded-lg border border-white/10 bg-[#0B2540] px-4 py-4 text-center">
                      <div className="text-xl font-extrabold text-emerald-300">
                        Bakiye: {formatUsd(balance)}
                      </div>
                    </div>
                  </div>

                  {/* Menu */}
                  <div className="mt-3 border-t border-white/10" />
                  <div className="grid gap-2 p-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                      onClick={() => setAccountModalOpen(true)}
                    >
                      <User className="h-4 w-4" /> Hesabım
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                      onClick={() => setDepositModalOpen(true)}
                    >
                      <ArrowDownCircle className="h-4 w-4" /> Para Yatır
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                      onClick={() => setWithdrawModalOpen(true)}
                    >
                      <ArrowDownCircle className="h-4 w-4 rotate-180" /> Para Çek
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                      onClick={() => setSupportModalOpen(true)}
                    >
                      <HelpCircle className="h-4 w-4" /> Destek Talebi
                    </button>

                    <div className="my-1 border-t border-white/10" />

                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-rose-300 hover:bg-white/10"
                      onClick={() => router.push(`/logout?next=${encodeURIComponent(next || "/")}`)}
                    >
                      <LogOut className="h-4 w-4" /> Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modals */}
      {depositModalOpen && (
        <DepositModal
          open={depositModalOpen}
          onClose={() => setDepositModalOpen(false)}
          onSuccess={reloadBalance}
        />
      )}
      {withdrawModalOpen && (
        <WithdrawModal
          open={withdrawModalOpen}
          onClose={() => setWithdrawModalOpen(false)}
          onSuccess={reloadBalance}
        />
      )}
      {supportModalOpen && (
        <SupportModal
          open={supportModalOpen}
          onClose={() => setSupportModalOpen(false)}
          onOpenHistory={() => {
            setSupportModalOpen(false);
            setSupportHistoryModalOpen(true);
          }}
        />
      )}
      {supportHistoryModalOpen && (
        <SupportHistoryModal
          open={supportHistoryModalOpen}
          onClose={() => {
            setSupportHistoryModalOpen(false);
            setSupportModalOpen(true);
          }}
          onBack={() => {
            setSupportHistoryModalOpen(false);
            setSupportModalOpen(true);
          }}
          tickets={[
            { id: 101, subject: "Para çekimim beklemede görünüyor", status: "Beklemede", createdAt: Date.now() - 15 * 60 * 1000 },
            { id: 100, subject: "Komisyon oranları nedir?", status: "Yanıtlandı", createdAt: Date.now() - 3 * 60 * 60 * 1000 },
            { id: 99, subject: "Hesabım doğrulandı mı?", status: "Kapalı", createdAt: Date.now() - 26 * 60 * 60 * 1000 },
            { id: 98, subject: "USDT yatırdım, bakiyeye yansımadı", status: "Açık", createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000 },
          ]}
        />
      )}
      {accountModalOpen && <AccountModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />}
    </>
  );
}
