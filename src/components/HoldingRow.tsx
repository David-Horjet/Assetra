"use client";

import { signedPercent, tokenAmount, usd } from "@/lib/format";
import type { Holding } from "@/lib/types";

/**
 * One position in the holdings list.
 *
 * Borrowable assets are the actionable ones, so they carry the mint accent
 * and a max-LTV hint; everything else stays quiet rather than being hidden,
 * which would misrepresent the portfolio.
 */
export function HoldingRow({
  holding,
  index,
  onSelect,
}: {
  holding: Holding;
  index: number;
  onSelect?: (holding: Holding) => void;
}) {
  const { asset, price, uiAmount, usdValue, vaults } = holding;
  const borrowable = vaults.length > 0;
  // Vaults are pre-sorted best-LTV first.
  const bestLtv = borrowable ? vaults[0].maxLtv : 0;
  const change = price?.priceChange24h ?? null;

  return (
    <button
      type="button"
      onClick={borrowable ? () => onSelect?.(holding) : undefined}
      disabled={!borrowable}
      className="rise group flex w-full items-center gap-4 rounded-card border px-4 py-4 text-left transition-colors duration-200 disabled:cursor-default"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--surface-carbon)",
        // Stagger down the list so it assembles rather than appearing at once.
        animationDelay: `${Math.min(index * 0.04, 0.4)}s`,
      }}
      onMouseEnter={(e) => {
        if (borrowable) e.currentTarget.style.borderColor = "var(--border-strong)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      <AssetMark asset={asset} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "var(--text-body)" }}>{asset.symbol}</span>
          {borrowable && (
            <span
              className="rounded-pill px-2 py-0.5"
              style={{
                fontSize: "11px",
                letterSpacing: "0.5px",
                color: "var(--color-signal-mint)",
                background: "rgba(63, 226, 128, 0.1)",
              }}
            >
              {Math.round(bestLtv * 100)}% LTV
            </span>
          )}
        </div>
        <div
          className="numeric truncate text-ash"
          style={{ fontSize: "var(--text-caption)" }}
        >
          {tokenAmount(uiAmount)} {asset.symbol}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="numeric" style={{ fontSize: "var(--text-body)" }}>
          {usdValue === null ? "—" : usd(usdValue, { compact: true })}
        </div>
        <div
          className="numeric"
          style={{
            fontSize: "var(--text-caption)",
            color:
              change === null
                ? "var(--color-ash)"
                : change >= 0
                  ? "var(--color-signal-mint)"
                  : "var(--color-ash)",
          }}
        >
          {signedPercent(change)}
        </div>
      </div>

      {borrowable && (
        <span
          className="text-ash opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ fontSize: "var(--text-body)" }}
          aria-hidden
        >
          →
        </span>
      )}
    </button>
  );
}

/** Asset logo, falling back to a monogram when the image is unavailable. */
function AssetMark({ asset }: { asset: Holding["asset"] }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ background: "var(--surface-graphite)" }}
    >
      {asset.logo ? (
        // Remote host is not in next.config images; a plain img avoids the
        // optimizer round-trip for a 40px mark.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.logo}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-ash" style={{ fontSize: "var(--text-caption)" }}>
          {asset.underlyingSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}
