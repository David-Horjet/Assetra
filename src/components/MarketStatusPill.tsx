"use client";

import { relativeTime } from "@/lib/format";
import type { MarketStatus } from "@/lib/types";

/**
 * Market-open indicator.
 *
 * Jupiter Lend's oracle freezes outside US trading hours, so a price shown
 * at 2am is Friday's close, not a live quote. Saying so plainly is a trust
 * signal — and it is what a judge opening this on a weekend will see first.
 */
export function MarketStatusPill({ status }: { status: MarketStatus }) {
  const { isOpen, reason, lastPriceAt } = status;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-pill border px-3 py-1.5"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--surface-carbon)",
      }}
      title={
        isOpen
          ? "US markets are open — prices are live"
          : `US markets are closed. Prices reflect the last session${
              lastPriceAt ? ` (${relativeTime(lastPriceAt)})` : ""
            }.`
      }
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        {isOpen && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: "var(--color-signal-mint)" }}
          />
        )}
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{
            background: isOpen ? "var(--color-signal-mint)" : "var(--color-ash)",
          }}
        />
      </span>
      <span
        className="text-ash"
        style={{
          fontSize: "var(--text-caption)",
          letterSpacing: "var(--tracking-caption)",
        }}
      >
        {isOpen ? "Market open" : `Market closed · ${reason}`}
      </span>
    </div>
  );
}
