// src/components/money/WithdrawModal.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { http } from "@/lib/http";
import { usePrices } from "@/hooks/usePrices"; // ⬅️ canlı kur
import type { AxiosError } from "axios";

type Method = "bank" | "crypto";
type Step = "choose" | "bankInfo" | "bankAmount" | "crypto";

type Coin = "USDT" | "BTC" | "ETH";
type Network = "TRC20" | "ERC20" | "BEP20" | "BTC" | "ETH";

// ---------- Ortak sayı formatlayıcılar (1,234.56) ----------
const fmt2 = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);
const fmtUSD = (n: number) => `${fmt2(n)} USD`;
const fmtTRY = (n: number) => `${fmt2(n)} TRY`;

/* --------- Tip yardımcıları --------- */
type FundingRequest = Record<string, unknown>;
type FundingResponse =
  | { request?: FundingRequest }
  | FundingRequest
  | null
  | undefined;

function isAxiosError<T = unknown>(e: unknown): e is AxiosError<T> {
  return typeof e === "object" && e !== null && "isAxiosError" in (e as Record<string, unknown>);
}
function pickErrMsg(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as unknown;
    const msg =
      (typeof data === "string" ? data : (data as { message?: string })?.message) ??
      e.message;
    return typeof msg === "string" ? msg : "Çekim talebi oluşturulamadı.";
  }
  return (e as Error)?.message || "Çekim talebi oluşturulamadı.";
}
function hasRequestKey(v: unknown): v is { request: FundingRequest } {
  return typeof v === "object" && v !== null && "request" in (v as Record<string, unknown>);
}

export default function WithdrawModal({
  open,
  onClose,
  onBack,
  onSubmit,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSubmit?: (payload: {
    method: Method;
    amountUsd: number;
    bank?: { bankName: string; currency: "TRY"; fullName: string; iban: string };
    crypto?: { coin: Coin; network: Network; address: string; amountCoin: number };
  }) => void;
  onSuccess?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [method, setMethod] = useState<Method>("bank");

  // Ortak
  const [amount, setAmount] = useState<string>("");

  // Banka alanları
  const [bankName, setBankName] = useState("");
  const [fullName, setFullName] = useState("");
  const [iban, setIban] = useState("");

  // Kripto alanları
  const [coin, setCoin] = useState<Coin>("USDT");
  const [network, setNetwork] = useState<Network | "">("");
  const [address, setAddress] = useState("");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Başarı kartı bilgisi
  const [successInfo, setSuccessInfo] = useState<
    | { method: Method; amountUsd: number; coin?: Coin; network?: Network }
    | null
  >(null);

  // ---------- Canlı USD/TRY ----------
  const { prices } = usePrices();
  const usdTryLive = useMemo(() => {
    const direct =
      (prices?.USDTRY as { price?: number } | undefined)?.price ??
      (prices?.["FOREXCOM:USDTRY"] as { price?: number } | undefined)?.price ??
      (prices?.["FX:USDTRY"] as { price?: number } | undefined)?.price ??
      null;
    if (Number.isFinite(direct)) return Number(direct);

    const inv =
      (prices?.TRYUSD as { price?: number } | undefined)?.price ??
      (prices?.["FOREXCOM:TRYUSD"] as { price?: number } | undefined)?.price ??
      (prices?.["FX:TRYUSD"] as { price?: number } | undefined)?.price ??
      null;
    if (Number.isFinite(inv) && Number(inv) > 0) return 1 / Number(inv);

    return null;
  }, [prices]);

  const USDTRY_FALLBACK = 41.5;
  const usdTryRate = usdTryLive ?? USDTRY_FALLBACK; // 1 USD = usdTryRate TRY
  const isLiveRate = usdTryLive != null;

  // Kurlardan bağımsız coin katsayıları (demo)
  const USDT_PER_USD = 1;
  const BTC_PER_USD = 0.0000087;
  const ETH_PER_USD = 0.00022;

  const amountNum = Number((amount || "").replace(",", "."));
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const coinAmount = useMemo(() => {
    if (!amountValid) return NaN;
    if (coin === "USDT") return amountNum * USDT_PER_USD;
    if (coin === "BTC") return amountNum * BTC_PER_USD;
    return amountNum * ETH_PER_USD;
  }, [amountValid, amountNum, coin]);
  const cryptoDecimals = coin === "USDT" ? 2 : 8;

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

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setMethod("bank");
    setAmount("");
    setBankName("");
    setFullName("");
    setIban("");
    setCoin("USDT");
    setNetwork("");
    setAddress("");
    setSubmitting(false);
    setOk(false);
    setError(null);
    setSuccessInfo(null);
  }, [open]);

  if (!open) return null;

  /* ---------- Input kısıtlayıcılar ---------- */
  function handleIbanChange(input: string) {
    const raw = input.toUpperCase().replace(/\s+/g, "");
    const limited = raw.slice(0, 26);
    setIban(limited);
  }
  function handleFullNameChange(input: string) {
    const cleaned = input
      .replace(/[^A-Za-zğüşiıöçĞÜŞİÖÇ\s]/g, "")
      .replace(/\s{2,}/g, " ");
    setFullName(cleaned);
  }

  /* ---------- Validasyonlar ---------- */
  const canProceedBankInfo =
    bankName.trim().length > 1 &&
    fullName.trim().length > 2 &&
    cleanIban(iban).length === 26;

  const canSubmitBankAmount = step === "bankAmount" && amountValid;

  const canSubmitCrypto =
    step === "crypto" &&
    amountValid &&
    !!coin &&
    !!network &&
    address.trim().length > 8;

  /* ---------- Backend talebi ---------- */
  async function createWithdrawFunding(amountUsd: number, reference: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await http.post<FundingResponse>("/api/wallet/funding", {
        type: "WITHDRAW",
        amount: amountUsd.toFixed(2), // Prisma Decimal → string
        reference,
      });

      const payload: FundingResponse = res?.data;
      const okResp = (hasRequestKey(payload) && payload.request) || payload;
      if (!okResp) throw new Error("Beklenmeyen yanıt.");

      setOk(true);
      onSuccess?.();
    } catch (e: unknown) {
      setError(pickErrMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Aksiyonlar ---------- */
  async function handlePrimary() {
    if (submitting || ok) return;

    if (step === "choose") {
      setStep(method === "bank" ? "bankInfo" : "crypto");
      return;
    }
    if (step === "bankInfo") {
      if (!canProceedBankInfo) return;
      setStep("bankAmount");
      return;
    }
    if (step === "bankAmount") {
      if (!canSubmitBankAmount) return;

      onSubmit?.({
        method: "bank",
        amountUsd: amountNum,
        bank: {
          bankName: bankName.trim(),
          currency: "TRY",
          fullName: fullName.trim(),
          iban: formatIban(cleanIban(iban)),
        },
      });

      const ref = `BANK WITHDRAW | bank=${bankName.trim()} name=${fullName.trim()} IBAN=${formatIban(
        cleanIban(iban)
      )} (${fmtTRY(amountNum * usdTryRate)}) @ ${isLiveRate ? "live" : "fallback"} ${fmtTRY(usdTryRate)}`;

      setSuccessInfo({ method: "bank", amountUsd: amountNum });
      await createWithdrawFunding(amountNum, ref);
      return;
    }
    if (step === "crypto") {
      if (!canSubmitCrypto) return;

      onSubmit?.({
        method: "crypto",
        amountUsd: amountNum,
        crypto: {
          coin,
          network: network as Network,
          address: address.trim(),
          amountCoin: Number(coinAmount.toFixed(cryptoDecimals)),
        },
      });

      const ref = `CRYPTO WITHDRAW | coin=${coin} net=${network} addr=${address.trim()} amount=${coinAmount.toFixed(
        cryptoDecimals
      )} ${coin}`;

      setSuccessInfo({ method: "crypto", amountUsd: amountNum, coin, network: network as Network });
      await createWithdrawFunding(amountNum, ref);
      return;
    }
  }

  function handleBack() {
    if (submitting || ok) return;
    if (step === "choose") {
      if (onBack) {
        onBack();
      } else {
        onClose();
      }
      return;
    }
    if (step === "bankAmount") {
      setStep("bankInfo");
      return;
    }
    setStep("choose");
  }

  /* ---------- Dialog ---------- */
  const dialog = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Modal */}
      <div className="relative w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0E2E51] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Para Çek</h2>
          <button
            onClick={onClose}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/50 bg-rose-600/25 text-rose-200 hover:bg-rose-600/35 hover:text-rose-100 ${
              submitting ? "opacity-50 cursor-not-allowed" : ""
            }`}
            aria-label="Kapat"
            disabled={submitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}

          {/* ✅ Başarı ekranı */}
          {ok ? (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="rounded-full bg-emerald-500/15 border border-emerald-400/40 px-4 py-2 text-emerald-300 text-sm">
                Talebiniz Alındı
              </div>
              <div className="text-slate-200">
                <span className="font-semibold">{fmtUSD(successInfo?.amountUsd ?? 0)}</span>{" "}
                çekim talebiniz alındı.
                <br />
                Onaylandıktan sonra işleme alınacaktır.
              </div>
            </div>
          ) : (
            <>
              {/* STEP: Choose */}
              {step === "choose" && (
                <>
                  <div className="mb-6 text-base font-medium text-slate-300">Para çekme yöntemi seçin:</div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setMethod("bank")}
                      className={`rounded-xl border px-5 py-8 text-left transition ${
                        method === "bank" ? "border-emerald-300/60 bg-emerald-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                      disabled={submitting}
                    >
                      <div className="text-white text-lg font-semibold">Banka ile Çek</div>
                      <p className="mt-2 text-[12px] leading-snug text-slate-300">TRY hesabınıza çekim yapın.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMethod("crypto")}
                      className={`rounded-xl border px-5 py-8 text-left transition ${
                        method === "crypto" ? "border-violet-300/60 bg-violet-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                      disabled={submitting}
                    >
                      <div className="text-white text-lg font-semibold">Kripto ile Çek</div>
                      <p className="mt-2 text-[12px] leading-snug text-slate-300">USDT/BTC/ETH olarak çekim yapın.</p>
                    </button>
                  </div>
                </>
              )}

              {/* STEP: Bank Info */}
              {step === "bankInfo" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Banka Adı"
                      placeholder="Örn. AKBANK"
                      value={bankName}
                      onChange={setBankName}
                      poppins
                      readOnly={submitting}
                    />
                    <Field label="Para Birimi" placeholder="TRY" value="TRY" onChange={() => {}} readOnly poppins />
                    <Field
                      label="Hesap Sahibi"
                      placeholder="Ad Soyad"
                      value={fullName}
                      onChange={handleFullNameChange}
                      poppins
                      readOnly={submitting}
                    />
                    <Field
                      label="IBAN"
                      placeholder="TR________________________"
                      value={formatIban(iban)}
                      onChange={handleIbanChange}
                      poppins
                      readOnly={submitting}
                    />
                  </div>

                  {!canProceedBankInfo && (
                    <div className="text-[12px] text-slate-400">Lütfen Banka Adı, Hesap Sahibi ve geçerli bir IBAN girin.</div>
                  )}
                </div>
              )}

              {/* STEP: Bank Amount */}
              {step === "bankAmount" && (
                <div className="space-y-7">
                  <div className="space-y-3">
                    <div className="text-base font-medium text-white">Tutar Girin</div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60"
                        disabled={submitting}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-300">USD</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[100, 250, 500].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAmount(String(v))}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10"
                          disabled={submitting}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    {/* Sarı uyarı + canlı kur bilgisi */}
                    <div className="space-y-2">
                      <div className="text-base text-amber-300">USD olarak çekilen paralar TRY olarak hesabınıza yansıyacaktır.</div>
                      {amountValid && (
                        <div className="text-base font-medium text-slate-200">{fmtTRY(amountNum * usdTryRate)}</div>
                      )}
                      <div className="text-[12px] text-slate-400">Güncel Kur: 1 USD = {fmtTRY(usdTryRate)}</div>
                    </div>

                    {!amountValid && amount !== "" && (
                      <div className="text-[12px] text-rose-300">Geçerli bir tutar girin.</div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP: Crypto */}
              {step === "crypto" && (
                <div className="space-y-7">
                  {/* Tutar (USD) */}
                  <div className="space-y-3">
                    <div className="text-base font-medium text-white">Tutar Girin</div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60"
                        disabled={submitting}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-300">USD</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[250, 500, 1000].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAmount(String(v))}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10"
                          disabled={submitting}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    {/* USD -> Coin bilgilendirme */}
                    <div className="space-y-2">
                      <div className="text-base text-amber-300">
                        Kripto çekimlerinde tutar, seçtiğiniz kripto para birimi olarak gönderilir.
                      </div>
                      {amountValid && (
                        <div className="flex items-center gap-3">
                          <div className="text-base font-medium text-slate-200">
                            {coinAmount.toFixed(cryptoDecimals)} {coin}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coin seçimi */}
                  <div>
                    <div className="mb-3 text-base text-slate-300">Coin seçiniz</div>
                    <div className="flex flex-wrap gap-3">
                      {(["USDT", "BTC", "ETH"] as Coin[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCoin(c);
                            setNetwork("");
                          }}
                          className={`rounded-full px-4 py-2 text-base border transition ${
                            coin === c ? "border-violet-300/70 bg-violet-300/15 text-white" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          }`}
                          disabled={submitting}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ağ seçimi */}
                  <div>
                    <div className="mb-3 text-base text-slate-300">Ağ seçiniz</div>
                    <div className="flex flex-wrap gap-3">
                      {networksFor(coin).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNetwork(n)}
                          className={`rounded-full px-4 py-2 text-base border transition ${
                            network === n ? "border-emerald-300/70 bg-emerald-300/15 text-white" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          }`}
                          disabled={submitting}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cüzdan adresi */}
                  <Field
                    label="Cüzdan Adresi"
                    placeholder={network ? `${coin} ${network} adresinizi giriniz.` : "Cüzdan adresinizi giriniz."}
                    value={address}
                    onChange={setAddress}
                    poppins
                    readOnly={submitting}
                  />

                  {!canSubmitCrypto && (
                    <div className="text-[12px] text-slate-400">Lütfen coin, ağ, adres ve geçerli bir tutar girin.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-8 py-6">
          {!ok ? (
            <>
              <button
                type="button"
                onClick={handleBack}
                className="min-w-[120px] h-10 rounded-md px-4 text-sm font-medium bg-white/10 text-slate-100 hover:bg-white/20"
                disabled={submitting}
              >
                Geri Dön
              </button>

              <button
                type="button"
                onClick={handlePrimary}
                disabled={
                  submitting ||
                  (step === "bankInfo" && !canProceedBankInfo) ||
                  (step === "bankAmount" && !canSubmitBankAmount) ||
                  (step === "crypto" && !canSubmitCrypto)
                }
                className={`min-w-[120px] h-10 rounded-md px-4 text-sm font-medium ${
                  submitting ||
                  (step === "bankInfo" && !canProceedBankInfo) ||
                  (step === "bankAmount" && !canSubmitBankAmount) ||
                  (step === "crypto" && !canSubmitCrypto)
                    ? "bg-emerald-600/60 text-white/70 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {submitting ? "Gönderiliyor..." : step === "choose" || step === "bankInfo" ? "Devam Et" : "Çekim Yap"}
              </button>
            </>
          ) : (
            <div className="ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="min-w-[120px] h-10 rounded-md px-4 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(dialog, document.body) : null;
}

/* ---------- Helpers ---------- */
function cleanIban(v: string) {
  return v.replace(/\s+/g, "").toUpperCase();
}
function formatIban(v: string) {
  return v.replace(/(.{4})/g, "$1 ").trim();
}
function networksFor(coin: Coin): Network[] {
  if (coin === "USDT") return ["TRC20", "ERC20", "BEP20"];
  if (coin === "BTC") return ["BTC"];
  return ["ERC20"]; // ETH
}

/* Input bileşeni */
function Field({
  label,
  placeholder,
  value,
  onChange,
  mono,
  poppins,
  readOnly,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  poppins?: boolean;
  readOnly?: boolean;
}) {
  const fontClasses = [
    mono ? "font-mono" : "",
    poppins ? "font-poppins tracking-wide placeholder:font-poppins" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div className="mb-2 text-sm text-slate-300">{label}</div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60 ${fontClasses} ${
          readOnly ? "opacity-80 cursor-not-allowed" : ""
        }`}
      />
    </div>
  );
}
