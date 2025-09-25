// src/components/money/DepositModal.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check } from "lucide-react";
import { http } from "@/lib/http";
import { usePrices } from "@/hooks/usePrices";
import type { AxiosError } from "axios";

type Method = "bank" | "crypto";
type Step = "choose" | "bank" | "crypto" | "amount";

type Coin = "USDT" | "BTC" | "ETH";
type Network = "TRC20" | "ERC20" | "BEP20" | "BTC" | "ETH";

const fmt2 = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );
const fmtUSD = (n: number) => `${fmt2(n)} USD`;
const fmtTRY = (n: number) => `${fmt2(n)} TRY`;

type FundingRequest = Record<string, unknown>;
type FundingResponse = { request?: FundingRequest } | FundingRequest | null | undefined;

function isAxiosError<T = unknown>(e: unknown): e is AxiosError<T> {
  return typeof e === "object" && e !== null && "isAxiosError" in (e as Record<string, unknown>);
}
function pickErrMsg(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as unknown;
    const msg =
      (typeof data === "string" ? data : (data as { message?: string })?.message) ?? e.message;
    return typeof msg === "string" ? msg : "Talep oluşturulamadı.";
  }
  return (e as Error)?.message || "Talep oluşturulamadı.";
}
function hasRequestKey(v: unknown): v is { request: FundingRequest } {
  return typeof v === "object" && v !== null && "request" in (v as Record<string, unknown>);
}

export default function DepositModal({
  open,
  onClose,
  onBack,
  onSuccess,
  onContinue,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSuccess?: () => void;
  onContinue?: (method: Method, amount?: number) => void;
  busy?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<Method>("bank");
  const [step, setStep] = useState<Step>("choose");

  // Bank fields
  const [iban, setIban] = useState<string>("");
  const [copied, setCopied] = useState<"iban" | "name" | "addr" | null>(null);

  // Amount (input)
  const [amount, setAmount] = useState<string>("");

  // Crypto state
  const [coin, setCoin] = useState<Coin>("USDT");
  const [network, setNetwork] = useState<Network | "">("");
  const address = useMemo(
    () => (network ? genAddress(coin, network as Network) : ""),
    [coin, network],
  );

  // UI state
  const [copiedCrypto, setCopiedCrypto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [successInfo, setSuccessInfo] = useState<
    | { method: Method; amountUsd: number; coin?: Coin; network?: Network }
    | null
  >(null);

  const disabled = busy || submitting;

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
  const usdTryRate = usdTryLive ?? USDTRY_FALLBACK;
  const isLiveRate = usdTryLive != null;

  const copyText = (val: string) => {
    void navigator.clipboard?.writeText(val);
    setCopiedCrypto(true);
    window.setTimeout(() => setCopiedCrypto(false), 1200);
  };
  useEffect(() => {
    setCopiedCrypto(false);
  }, [amount, coin]);

  useEffect(() => setMounted(true), []);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep("choose");
      setMethod("bank");
      setCopied(null);
      setAmount("");
      setCoin("USDT");
      setNetwork("");
      setCopiedCrypto(false);
      setSubmitting(false);
      setOk(false);
      setError(null);
      setSuccessInfo(null);
    }
  }, [open]);

  // Demo IBAN
  useEffect(() => {
    if (step === "bank") setIban(genTrIban());
  }, [step]);

  if (!open) return null;

  const footerBtn =
    "min-w-[120px] h-10 rounded-md px-4 text-sm font-medium transition-colors";

  function copy(text: string, what: "iban" | "name" | "addr") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  const amountNum = Number((amount || "").replace(",", "."));
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const USDT_PER_USD = 1;
  const BTC_PER_USD = 0.0000087;
  const ETH_PER_USD = 0.00022;

  function cryptoFromUsd(c: Coin, usd: number) {
    if (!Number.isFinite(usd) || usd <= 0) return NaN;
    if (c === "USDT") return usd * USDT_PER_USD;
    if (c === "BTC") return usd * BTC_PER_USD;
    if (c === "ETH") return usd * ETH_PER_USD;
    return NaN;
  }

  const rightBtnLabel =
    step === "amount" || step === "crypto" ? (submitting ? "Gönderiliyor..." : "Yatırım Yap") : "Devam Et";

  async function createFundingRequest(usdAmount: number, metaNote: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await http.post<FundingResponse>("/api/wallet/funding", {
        type: "DEPOSIT",
        amount: usdAmount.toFixed(2),
        reference: metaNote,
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

  async function handleFinalize() {
    if (onContinue) {
      onContinue(method, amountValid ? amountNum : undefined);
      return;
    }
    if (!amountValid) return;

    if (method === "crypto") {
      const usd = amountNum;
      const meta = `CRYPTO | coin=${coin} network=${network} addr=${address}`;
      setSuccessInfo({ method: "crypto", amountUsd: usd, coin, network: network as Network });
      await createFundingRequest(usd, meta);
      return;
    }

    if (method === "bank") {
      const usd = amountNum / usdTryRate;
      const meta = `BANK | IBAN=${formatIban(iban)} TRY=${fmt2(amountNum)} (${fmtUSD(usd)}) @ ${
        isLiveRate ? "live" : "fallback"
      } ${fmtTRY(usdTryRate)}`;
      setSuccessInfo({ method: "bank", amountUsd: usd });
      await createFundingRequest(usd, meta);
      return;
    }
  }

  function handleRightAction() {
    if (disabled || ok) return;

    if (step === "choose") {
      setStep(method === "bank" ? "bank" : "crypto");
      return;
    }

    if (step === "bank") {
      setAmount("");
      setStep("amount");
      return;
    }

    if (step === "crypto" || step === "amount") {
      if (!amountValid) return;
      if (step === "crypto" && (!coin || !network || !address)) return;
      // ❗ UYARIYI ÖNLER: Sonucu bilerek yok sayıyoruz
      void handleFinalize();
      return;
    }
  }

  function handleLeftAction() {
    if (disabled || ok) return;
    if (step === "choose") {
      onBack ? onBack() : onClose();
      return;
    }
    if (step === "amount") {
      setStep("bank");
      return;
    }
    setStep("choose");
    setCopied(null);
  }

  const dialog = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Para yatır"
        className="relative w-[min(96vw,700px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0E2E51] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Para Yatır</h2>
          <button
            onClick={() => {
              if (disabled) return;
              onClose();
            }}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/50 bg-rose-600/25 text-rose-200 hover:bg-rose-600/35 hover:text-rose-100 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label="Kapat"
            disabled={disabled}
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
                yatırım talebiniz alındı.
                <br />
                Onaylandıktan sonra bakiyenize yansıyacaktır.
              </div>
            </div>
          ) : (
            <>
              {/* STEP: Choose */}
              {step === "choose" && (
                <>
                  <div className="mb-6 text-base font-medium text-slate-300">
                    Para yatırma yöntemi seçin:
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (disabled) return;
                        setMethod("bank");
                      }}
                      className={`rounded-xl border px-5 py-8 text-left transition ${
                        method === "bank"
                          ? "border-emerald-300/60 bg-emerald-300/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={disabled}
                    >
                      <div className="text-white text-lg font-semibold">Havale/EFT ile Yatır</div>
                      <p className="mt-2 text-[12px] leading-snug text-slate-300">
                        Banka Havalesi veya EFT ile para yatırın.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (disabled) return;
                        setMethod("crypto");
                      }}
                      className={`rounded-xl border px-5 py-8 text-left transition ${
                        method === "crypto"
                          ? "border-violet-300/60 bg-violet-300/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={disabled}
                    >
                      <div className="text-white text-lg font-semibold">Kripto ile Yatır</div>
                      <p className="mt-2 text-[12px] leading-snug text-slate-300">
                        USDT, BTC, ETH ile para yatırın.
                      </p>
                    </button>
                  </div>
                </>
              )}

              {/* STEP: Bank */}
              {step === "bank" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Banka Adı" value="AKBANK" />
                    <Info label="Para Birimi" value="TRY" />
                  </div>

                  <Info
                    label="Hesap Sahibi"
                    value="OZEX Bilişim Ticaret Limited Şirketi"
                    copyable
                    onCopy={() => copy("OZEX Bilişim Ticaret Limited Şirketi", "name")}
                    copied={copied === "name"}
                  />

                  <Info
                    label="IBAN"
                    value={formatIban(iban)}
                    poppins
                    copyable
                    onCopy={() => copy(formatIban(iban), "iban")}
                    copied={copied === "iban"}
                  />

                  <Info
                    label="Açıklama"
                    value="Ad Soyad"
                    hint="Lütfen açıklama kısmına kendi adınız ve soyadınız dışında bir şey yazmayınız."
                  />
                </div>
              )}

              {/* STEP: Crypto */}
              {step === "crypto" && (
                <div className="space-y-7">
                  {/* Amount (USD) */}
                  <div className="space-y-3">
                    <div className="text-base font-medium text-white">Tutar Girin</div>
                    <div className="flex items-stretch gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60"
                          disabled={disabled}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-300">
                          USD
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {quickAmounts(method).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            if (disabled) return;
                            setAmount(String(v));
                          }}
                          className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={disabled}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-base text-amber-300">
                        Kripto olarak yatırılan tutar USD olarak hesabınıza yansıyacaktır.
                      </div>
                      {amountValid && (
                        <div className="flex items-center gap-3">
                          <div className="text-base font-medium text-slate-200">
                            {cryptoFromUsd(coin, amountNum).toFixed(coin === "USDT" ? 2 : 8)} {coin}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const val = cryptoFromUsd(coin, amountNum).toFixed(coin === "USDT" ? 2 : 8);
                              copyText(val);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[12px] text-slate-100 hover:bg-white/20"
                            title="Kopyala"
                          >
                            {copiedCrypto ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedCrypto ? "Kopyalandı" : "Kopyala"}
                          </button>
                        </div>
                      )}
                    </div>

                    {!amountValid && amount !== "" && (
                      <div className="text-[12px] text-rose-300">Geçerli bir tutar girin.</div>
                    )}
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
                            if (disabled) return;
                            setCoin(c);
                            setNetwork("");
                          }}
                          className={`rounded-full px-4 py-2 text-base border transition ${
                            coin === c
                              ? "border-violet-300/70 bg-violet-300/15 text-white"
                              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={disabled}
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
                          onClick={() => {
                            if (disabled) return;
                            setNetwork(n);
                          }}
                          className={`rounded-full px-4 py-2 text-base border transition ${
                            network === n
                              ? "border-emerald-300/70 bg-emerald-300/15 text-white"
                              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={disabled}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Adres kutusu */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-2 text-[12px] uppercase tracking-wide text-slate-400">
                      Cüzdan Adresi
                    </div>

                    {network ? (
                      <>
                        <div className="font-poppins tracking-wide text-base text-amber-200 break-all">
                          {address}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              copy(address, "addr");
                            }}
                            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-[12px] text-slate-100 hover:bg-white/20"
                            disabled={disabled}
                          >
                            {copied === "addr" ? (
                              <>
                                <Check className="h-4 w-4" />
                                Kopyalandı
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Kopyala
                              </>
                            )}
                          </button>
                          <span className="text-[12px] text-slate-300">
                            Lütfen yalnızca{" "}
                            <span className="text-white font-medium">{coin}</span>{" "}
                            <span className="text-white font-medium">{network}</span> ağı üzerinden gönderim yapın.
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-300">Lütfen önce bir ağ seçiniz.</div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP: Amount (sadece banka) */}
              {step === "amount" && (
                <div className="space-y-6">
                  <div className="text-base font-medium text-white">Tutar Girin</div>

                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60"
                        disabled={disabled}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-300">
                        TRY
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {quickAmounts(method).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          if (disabled) return;
                          setAmount(String(v));
                        }}
                        className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={disabled}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-base text-amber-300">
                      TRY olarak yatırılan paralar USD olarak hesabınıza yansıyacaktır.
                    </div>

                    {amountValid && (
                      <div className="text-base font-medium text-slate-200">
                        {fmtUSD(amountNum / usdTryRate)}
                      </div>
                    )}

                    <div className="text-[12px] text-slate-400">
                      Güncel Kur: 1 USD = {fmtTRY(usdTryRate)}
                    </div>
                  </div>

                  {!amountValid && amount !== "" && (
                    <div className="text-[12px] text-rose-300">Geçerli bir tutar girin.</div>
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
                onClick={handleLeftAction}
                className={`${footerBtn} bg-white/10 text-slate-100 hover:bg-white/20 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={disabled}
              >
                Geri Dön
              </button>

              <button
                type="button"
                onClick={handleRightAction}
                disabled={
                  disabled ||
                  (step === "amount" && !amountValid) ||
                  (step === "crypto" && (!coin || !network || !address || !amountValid))
                }
                className={`${footerBtn} ${
                  disabled ||
                  (step === "amount" && !amountValid) ||
                  (step === "crypto" && (!coin || !network || !address || !amountValid))
                    ? "bg-emerald-600/60 text-white/70 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {rightBtnLabel}
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

/* ---------------- Helpers ---------------- */

function genTrIban() {
  let digits = "";
  for (let i = 0; i < 24; i++) digits += Math.floor(Math.random() * 10);
  return `TR${digits}`;
}

function formatIban(iban: string) {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

function quickAmounts(method: Method) {
  return method === "bank" ? [5000, 10000, 20000] : [250, 500, 1000];
}

function networksFor(coin: Coin): Network[] {
  if (coin === "USDT") return ["TRC20", "ERC20", "BEP20"];
  if (coin === "BTC") return ["BTC"];
  return ["ERC20"]; // ETH
}

function genAddress(coin: Coin, network: Network) {
  const rand = (
    len: number,
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789",
  ) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  if (coin === "USDT") {
    if (network === "TRC20") return "T" + rand(33);
    if (network === "BEP20" || network === "ERC20") return "0x" + rand(40, "abcdef0123456789");
  }
  if (coin === "BTC") return "bc1" + rand(38, "023456789acdefghjklmnpqrstuvwxyz");
  if (coin === "ETH") return "0x" + rand(40, "abcdef0123456789");
  return rand(42);
}

function Info({
  label,
  value,
  hint,
  poppins,
  copyable,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  hint?: string;
  poppins?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm text-slate-100 break-all ${poppins ? "font-poppins tracking-wide" : ""}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
      {copyable && (
        <button
          type="button"
          onClick={onCopy}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/20"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Kopyalandı
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Kopyala
            </>
          )}
        </button>
      )}
    </div>
  );
}
