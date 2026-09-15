"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, SheetRow } from "@/components/Sheet";
import { percent, tokenAmount, usd } from "@/lib/format";
import type { QuoteSummary } from "@/lib/jupiter/swap";
import type { XStockAsset } from "@/lib/types";

interface BuySheetProps {
  asset: XStockAsset;
  /** Live price, for the estimate shown before a quote returns. */
  price: number | null;
  /** USDC the wallet can spend. */
  usdcBalance: number;
  stockDecimals?: number;
  onClose: () => void;
  onConfirm: (quote: QuoteSummary) => void;
  busy?: boolean;
  error?: string | null;
}

const PRESETS = [25, 50, 100, 250];

/** Price impact above this is worth warning about on a thin pool. */
const HIGH_IMPACT = 0.01;

/**
 * Buy an xStock with USDC through Jupiter.
 *
 * Quotes are live and expire, so the sheet re-quotes as the amount settles
 * and shows exactly what will be received before anything is signed.
 */
export function BuySheet({
  asset,
  price,
  usdcBalance,
  stockDecimals = 8,
  onClose,
  onConfirm,
  busy = false,
  error = null,
}: BuySheetProps) {
  const [amount, setAmount] = useState(50);
  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Ignore responses from superseded requests: typing fires several and they
  // can resolve out of order.
  const requestId = useRef(0);

  const loadQuote = useCallback(
    async (usdcAmount: number) => {
      if (!(usdcAmount > 0)) {
        setQuote(null);
        setQuoteError(null);
        return;
      }

      const id = ++requestId.current;
      setQuoting(true);
      setQuoteError(null);

      try {
        const res = await fetch("/api/swap/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side: "buy",
            mint: asset.mint,
            amount: usdcAmount,
            stockDecimals,
          }),
        });
        const json = await res.json();
        if (id !== requestId.current) return;

        if (!res.ok) {
          setQuote(null);
          setQuoteError(json.error ?? "Could not get a quote.");
          return;
        }
        setQuote(json as QuoteSummary);
      } catch {
        if (id === requestId.current) {
          setQuoteError("Could not reach Jupiter. Check your connection.");
        }
      } finally {
        if (id === requestId.current) setQuoting(false);
      }
    },
    [asset.mint, stockDecimals],
  );

  // Debounce so dragging or typing does not fire a quote per keystroke.
  useEffect(() => {
    const t = setTimeout(() => void loadQuote(amount), 350);
    return () => clearTimeout(t);
  }, [amount, loadQuote]);

  const insufficient = amount > usdcBalance;
  const canSubmit = Boolean(quote) && !insufficient && !busy && amount > 0;
  const highImpact = (quote?.priceImpact ?? 0) > HIGH_IMPACT;

  // Show the live estimate until a real quote lands, so the sheet is never
  // blank while typing.
  const estimated = price && price > 0 ? amount / price : null;

  return (
    <Sheet
      title={`Buy ${asset.symbol}`}
      subtitle={asset.name}
      logo={asset.logo}
      onClose={onClose}
    >
      <FieldLabel>You pay</FieldLabel>

      <div
        className="mt-2 flex items-center gap-3 rounded-card border px-4 py-3.5"
        style={{
          borderColor: insufficient
            ? "rgba(226,92,92,0.4)"
            : "var(--border-subtle)",
          background: "var(--surface-abyss)",
        }}
      >
        <span className="text-ash" style={{ fontSize: "var(--text-subheading)" }}>
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={amount || ""}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          disabled={busy}
          aria-label="Amount in USDC"
          className="numeric-display w-full bg-transparent outline-none"
          style={{ fontSize: "var(--text-heading-sm)" }}
        />
        <span
          className="shrink-0 text-ash"
          style={{ fontSize: "var(--text-caption)" }}
        >
          USDC
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              disabled={busy}
              className="rounded-pill border px-3 py-1 transition-colors hover:text-chalk"
              style={{
                borderColor:
                  amount === p ? "var(--border-strong)" : "var(--border-subtle)",
                color: amount === p ? "var(--color-chalk)" : "var(--color-ash)",
                fontSize: "var(--text-caption)",
              }}
            >
              ${p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAmount(Math.floor(usdcBalance * 100) / 100)}
          disabled={busy || usdcBalance <= 0}
          className="text-ash transition-colors hover:text-chalk disabled:opacity-40"
          style={{ fontSize: "var(--text-caption)" }}
        >
          Balance {usd(usdcBalance)}
        </button>
      </div>

      <FieldLabel className="mt-7">You receive</FieldLabel>
      <div
        className="numeric-display mt-2"
        style={{
          fontFamily: "var(--font-aeonik)",
          fontSize: "clamp(32px, 9vw, 48px)",
          lineHeight: 1.05,
          letterSpacing: "-1px",
          // Dim while re-quoting so a stale figure never looks authoritative.
          opacity: quoting ? 0.45 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {quote
          ? tokenAmount(quote.outUiAmount, 6)
          : estimated
            ? `≈ ${tokenAmount(estimated, 6)}`
            : "—"}
        <span className="text-ash" style={{ fontSize: "var(--text-body)" }}>
          {" "}
          {asset.symbol}
        </span>
      </div>

      <div className="mt-7 rounded-card border" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-abyss)" }}>
        <SheetRow label="Price">
          {price ? (
            <span className="numeric">{usd(price)} per share</span>
          ) : (
            <span className="text-ash">—</span>
          )}
        </SheetRow>
        <SheetRow label="Price impact">
          <span
            className="numeric"
            style={{ color: highImpact ? "#e2c53f" : undefined }}
          >
            {quote ? percent(quote.priceImpact, 3) : "—"}
          </span>
        </SheetRow>
        <SheetRow label="Minimum received">
          {quote ? (
            <span className="numeric">
              {tokenAmount(quote.minOutUiAmount, 6)} {asset.symbol}
            </span>
          ) : (
            <span className="text-ash">—</span>
          )}
        </SheetRow>
        <SheetRow label="Route" last>
          <span className="text-ash">
            {quote?.route.length ? quote.route.join(" → ") : "Jupiter"}
          </span>
        </SheetRow>
      </div>

      <AnimatePresence>
        {(error || quoteError || insufficient) && (
          <Notice tone="error">
            {insufficient
              ? `You need ${usd(amount - usdcBalance)} more USDC.`
              : (error ?? quoteError)}
          </Notice>
        )}
        {!insufficient && !error && !quoteError && highImpact && (
          <Notice tone="warn">
            Price impact is high for this size. Consider a smaller amount.
          </Notice>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.01 } : undefined}
        whileTap={canSubmit ? { scale: 0.99 } : undefined}
        onClick={() => quote && onConfirm(quote)}
        className="mt-6 w-full py-4 text-abyss transition-opacity disabled:opacity-35"
        style={{
          borderRadius: "var(--radius-herobutton)",
          background: "var(--color-signal-mint)",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-weight-medium)",
        }}
      >
        {busy
          ? "Preparing…"
          : quoting
            ? "Getting best price…"
            : `Buy ${asset.symbol}`}
      </motion.button>

      <p
        className="mt-3 text-center text-ash"
        style={{ fontSize: "var(--text-caption)" }}
      >
        Routed through Jupiter for the best available price.
      </p>
    </Sheet>
  );
}

function FieldLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`uppercase text-ash ${className}`}
      style={{
        fontSize: "var(--text-caption)",
        letterSpacing: "var(--tracking-caption)",
      }}
    >
      {children}
    </div>
  );
}

function Notice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "warn";
}) {
  const color = tone === "error" ? "#e2917c" : "#e2c53f";
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 overflow-hidden rounded-card px-4 py-3"
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        fontSize: "var(--text-caption)",
      }}
    >
      {children}
    </motion.div>
  );
}
