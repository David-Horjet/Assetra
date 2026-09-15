"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { signedPercent, usd } from "@/lib/format";
import type { MarketAsset } from "@/lib/market";

/**
 * Choose a stock to buy.
 *
 * Search matches ticker, company name and the underlying symbol, so "apple",
 * "AAPL" and "AAPLx" all find the same asset.
 */
export function StockPicker({
  assets,
  loading,
  onSelect,
  onClose,
}: {
  assets: MarketAsset[];
  loading: boolean;
  onSelect: (asset: MarketAsset) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on open so the list is searchable without a click.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.asset.symbol.toLowerCase().includes(q) ||
        a.asset.name.toLowerCase().includes(q) ||
        a.asset.underlyingSymbol.toLowerCase().includes(q),
    );
  }, [assets, query]);

  const borrowableCount = filtered.filter((a) => a.vaults.length > 0).length;

  return (
    <Sheet title="Buy a stock" subtitle="Tokenized equities on Solana" onClose={onClose}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Apple, NVDA, gold…"
        aria-label="Search stocks"
        className="w-full rounded-card border bg-transparent px-4 py-3 outline-none transition-colors focus:border-(--border-strong)"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-abyss)",
          fontSize: "var(--text-body)",
        }}
      />

      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[62px] animate-pulse rounded-card"
              style={{ background: "var(--surface-abyss)" }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p
          className="mt-8 text-center text-ash"
          style={{ fontSize: "var(--text-caption)" }}
        >
          No tradeable stock matches “{query}”.
        </p>
      ) : (
        <div className="mt-4 flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
          {filtered.map((a, i) => (
            <div key={a.asset.mint}>
              {/* Separate the assets that can be used as collateral from the
                  ones that can only be held — the distinction decides what a
                  user can do next. */}
              {i === borrowableCount && borrowableCount > 0 && (
                <div
                  className="px-1 pb-2 pt-5 uppercase text-ash"
                  style={{
                    fontSize: "var(--text-caption)",
                    letterSpacing: "var(--tracking-caption)",
                  }}
                >
                  Hold only · no lending market
                </div>
              )}
              <Row asset={a} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function Row({
  asset,
  onSelect,
}: {
  asset: MarketAsset;
  onSelect: (asset: MarketAsset) => void;
}) {
  const { asset: a, price, vaults } = asset;
  const bestLtv = vaults.length > 0 ? vaults[0].maxLtv : 0;
  const change = price.priceChange24h;

  return (
    <button
      type="button"
      onClick={() => onSelect(asset)}
      className="flex w-full items-center gap-3 rounded-card border px-3 py-3 text-left transition-colors hover:border-(--border-strong)"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--surface-abyss)",
      }}
    >
      {a.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.logo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ash"
          style={{
            background: "var(--surface-graphite)",
            fontSize: "var(--text-caption)",
          }}
        >
          {a.underlyingSymbol.slice(0, 2)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "var(--text-body)" }}>{a.symbol}</span>
          {bestLtv > 0 && (
            <span
              className="rounded-pill px-1.5 py-0.5"
              style={{
                fontSize: "11px",
                color: "var(--color-signal-mint)",
                background: "rgba(63, 226, 128, 0.1)",
              }}
            >
              {Math.round(bestLtv * 100)}% LTV
            </span>
          )}
        </div>
        <div
          className="truncate text-ash"
          style={{ fontSize: "var(--text-caption)" }}
        >
          {a.name.replace(/ xStock$/, "")}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="numeric" style={{ fontSize: "var(--text-caption)" }}>
          {usd(price.usdPrice)}
        </div>
        <div
          className="numeric"
          style={{
            fontSize: "var(--text-caption)",
            color:
              change === null || change === 0
                ? "var(--color-ash)"
                : change > 0
                  ? "var(--color-signal-mint)"
                  : "var(--color-ash)",
          }}
        >
          {signedPercent(change)}
        </div>
      </div>
    </button>
  );
}
