"use client";

export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-[#0B2540] text-slate-100 px-4">
      <div className="w-full max-w-[520px] rounded-2xl border border-white/10 bg-[#0E2E51] shadow-lg">
        {children}
      </div>
    </div>
  );
}
