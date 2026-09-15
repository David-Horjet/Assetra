"use client";

import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { CapitalBar } from "@/components/CapitalBar";
import { HoldingRow } from "@/components/HoldingRow";
import { MarketStatusPill } from "@/components/MarketStatusPill";
import { shortAddress, usd } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/portfolio";
import type { Holding } from "@/lib/types";

interface HomeScreenProps {
  snapshot: PortfolioSnapshot;
  walletAddress: string;
  onSelectHolding?: (holding: Holding) => void;
}

/**
 * Home — the capital view.
 *
 * Answers one question above the fold: how much of my capital is idle, and
 * what can I do about it. Everything else is secondary.
 */
export function HomeScreen({
  snapshot,
  walletAddress,
  onSelectHolding,
}: HomeScreenProps) {
  const { capital, holdings, marketStatus, usdcBalance, warning } = snapshot;
  const borrowable = holdings.filter((h) => h.vaults.length > 0);
  const idleAndBorrowable = borrowable.length > 0 && capital.idleUsd > 0;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "var(--page-max-width)" }}>
      <Header walletAddress={walletAddress} marketStatus={marketStatus} />

      <main className="px-6 pb-24 sm:px-10">
        <section className="pt-12 sm:pt-20">
          <div
            className="uppercase text-ash"
            style={{
              fontSize: "var(--text-caption)",
              letterSpacing: "var(--tracking-caption)",
            }}
          >
            Your capital
          </div>

          <div
            className="rise numeric mt-3"
            style={{
              fontSize: "clamp(44px, 9vw, var(--text-display))",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-display)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            <AnimatedNumber value={capital.totalUsd} format={(v) => usd(v)} />
          </div>

          {usdcBalance > 0 && (
            <div
              className="numeric mt-3 text-ash"
              style={{ fontSize: "var(--text-body)" }}
            >
              {usd(usdcBalance)} USDC available
            </div>
          )}

          <div className="mt-10 max-w-xl">
            <CapitalBar
              workingUsd={capital.workingUsd}
              idleUsd={capital.idleUsd}
            />
          </div>

          {idleAndBorrowable && (
            <motion.button
              type="button"
              onClick={() => onSelectHolding?.(borrowable[0])}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="rise mt-10 inline-flex items-center gap-3 px-7 py-4 text-abyss"
              style={{
                borderRadius: "var(--radius-herobutton)",
                background: "var(--color-signal-mint)",
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-weight-medium)",
                animationDelay: "0.25s",
              }}
            >
              Put idle capital to work
              <span aria-hidden>→</span>
            </motion.button>
          )}
        </section>

        <section className="mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              style={{
                fontSize: "var(--text-subheading)",
                letterSpacing: "var(--tracking-subheading)",
              }}
            >
              Your stocks
            </h2>
            {warning && (
              <span
                className="text-ash"
                style={{ fontSize: "var(--text-caption)" }}
                title="Assets without a market price are excluded from valuation rather than counted as zero."
              >
                {warning}
              </span>
            )}
          </div>

          {holdings.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              {holdings.map((h, i) => (
                <div key={h.asset.mint}>
                  {/* Mark where actionable assets end, so the rest reads as
                      context rather than as options that failed to work. */}
                  {i === borrowable.length && borrowable.length > 0 && (
                    <div
                      className="px-1 pb-3 pt-8 uppercase text-ash"
                      style={{
                        fontSize: "var(--text-caption)",
                        letterSpacing: "var(--tracking-caption)",
                      }}
                    >
                      No lending market yet
                    </div>
                  )}
                  <HoldingRow
                    holding={h}
                    index={i}
                    onSelect={onSelectHolding}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Header({
  walletAddress,
  marketStatus,
}: {
  walletAddress: string;
  marketStatus: HomeScreenProps["snapshot"]["marketStatus"];
}) {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-10">
      <div className="flex shrink-0 items-center gap-3">
        <div
          className="h-6 w-6 rounded-md"
          style={{ background: "var(--color-signal-mint)" }}
          aria-hidden
        />
        <span
          style={{
            fontSize: "var(--text-body)",
            letterSpacing: "var(--tracking-body)",
          }}
        >
          Assetra
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden sm:block">
          <MarketStatusPill status={marketStatus} />
        </div>
        <div
          className="numeric shrink-0 rounded-pill border px-3 py-1.5 text-ash"
          style={{
            borderColor: "var(--border-subtle)",
            fontSize: "var(--text-caption)",
          }}
        >
          {shortAddress(walletAddress)}
        </div>
      </div>
    </header>
  );
}

/**
 * Empty state for a wallet holding no priceable xStocks. Names the four
 * assets that actually work rather than leaving the user to guess.
 */
function EmptyState() {
  return (
    <div
      className="mt-6 rounded-card border px-6 py-16 text-center"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--surface-carbon)",
      }}
    >
      <div style={{ fontSize: "var(--text-subheading)" }}>
        No tokenized stocks yet
      </div>
      <p
        className="mx-auto mt-3 max-w-sm text-ash"
        style={{ fontSize: "var(--text-body)" }}
      >
        Assetra works with xStocks on Solana. Hold NVDAx, SPYx, QQQx or TSLAx to
        borrow against them without selling.
      </p>
    </div>
  );
}
