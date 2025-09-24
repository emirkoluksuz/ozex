// /components/MarketRow.tsx
"use client";
import { memo, useMemo } from "react";
import { Star } from "lucide-react";

export type Market = { symbol: string; price: string; change: number };

type Props = Market & {
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onSelect?: (s: string) => void;
  selected?: boolean;
};

function Row({
  symbol,
  price,
  change,
  isFavorite,
  onToggleFavorite,
  onSelect,
  selected,
}: Props) {
  const hasLive = price !== "-" && price !== "";
  const normChange = Number.isFinite(Number(change)) ? Number(change) : 0;

  const { pctText, pctClass, priceTextClass } = useMemo(() => {
    const up = normChange > 0;
    const down = normChange < 0;
    const priceCls = hasLive ? "text-white" : "text-slate-300";

    const pctCls = !hasLive
      ? "text-slate-300"
      : up
      ? "text-emerald-300"
      : down
      ? "text-rose-300"
      : "text-yellow-300";

    const pct = `${up ? "+" : ""}${normChange.toFixed(2)}%`;

    return {
      pctText: pct,
      pctClass: pctCls,
      priceTextClass: priceCls,
    };
  }, [hasLive, normChange]);

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer ${
        selected ? "bg-white/10 rounded-md" : ""
      }`}
      onClick={() => onSelect?.(symbol)}
      role="button"
      tabIndex={0}
      aria-label={`${symbol} ${hasLive ? price : "—"} ${pctText}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.(symbol);
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.();
          }}
          className={isFavorite ? "text-yellow-400" : "text-slate-400 hover:text-yellow-300"}
          title={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
          aria-pressed={!!isFavorite}
          aria-label={isFavorite ? `${symbol} favoriden çıkar` : `${symbol} favorilere ekle`}
        >
          <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
        </button>
        <div className="select-none">
          <div className="text-sm font-medium">{symbol}</div>
          <div className="text-[11px] text-slate-400">Sembol</div>
        </div>
      </div>

      <div className="text-right">
        <div className={`text-sm tabular-nums ${priceTextClass}`}>{hasLive ? price : "-"}</div>
        <div className={`text-[11px] tabular-nums ${pctClass}`}>{pctText}</div>
      </div>
    </div>
  );
}

export default memo(Row);
