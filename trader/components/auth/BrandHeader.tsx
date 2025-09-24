"use client";

export default function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="px-8 pt-8 pb-6 border-b border-white/10">
      <div className="flex flex-col items-center text-center">
        {/* Marka */}
        <div className="text-3xl font-extrabold tracking-tight">
          <span className="text-amber-300">OZEX</span>{" "}
          <span className="text-white">FINANCE</span>
        </div>

        {/* Alt başlık */}
        {subtitle ? (
          <p className="mt-3 text-base text-slate-300">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
