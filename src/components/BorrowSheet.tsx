"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { HealthPill } from "@/components/HealthPill";
import {
  computeLtv,
  healthState,
  liquidationPrice,
  maxBorrowUsd,
  monthlyBorrowCost,
  validateBorrow,
} from "@/lib/borrow-math";
import { percent, tokenAmount, usd } from "@/lib/format";
import type { BorrowVault, Holding } from "@/lib/types";

interface BorrowSheetProps {
  holding: Holding;
  onClose: () => void;
  onConfirm: (args: {
    vault: BorrowVault;
    collateralAmount: number;
    borrowAmount: number;
  }) => void;
  /** Set while a transaction is being built or signed. */
  busy?: boolean;
  error?: string | null;
}

/**
 * Borrow against a holding.
 *
 * The slider is the product's signature interaction: every figure below it
 * recomputes as it moves, so the trade-off between liquidity and risk is
 * visible rather than explained.
 */
export function BorrowSheet({
  holding,
  onClose,
  onConfirm,
  busy = false,
  error = null,
}: BorrowSheetProps) {
  // Prefer the USDC vault — it is the asset users actually want unlocked.
  const vault = useMemo(() => {
    const usdc = holding.vaults.find((v) => v.borrowSymbol === "USDC");
    return usdc ?? holding.vaults[0];
  }, [holding.vaults]);

  const collateralUsd = holding.usdValue ?? 0;
  const borrowTokenPrice = 1; // USDC/JupUSD track the dollar closely enough here.

  const maxBorrow = useMemo(
    () => maxBorrowUsd(collateralUsd, vault, borrowTokenPrice),
    [collateralUsd, vault],
  );

  /**
   * Opening amount.
   *
   * A third of capacity is a sensible default on a large position, but on a
   * small one it lands near the protocol minimum — $2.15 against $10 of
   * collateral, which reads as broken rather than cautious.
   *
   * Small positions therefore open at half of capacity. On a 75% LTV vault
   * that is 37.5% LTV: still "Healthy", with roughly 56% of price headroom
   * before liquidation. 60% would tip the opening state into "Moderate",
   * which is the wrong first impression for a position this conservative.
   */
  const [amount, setAmount] = useState(() => {
    const fraction = collateralUsd < 200 ? 0.5 : 0.33;
    return Math.floor(maxBorrow * fraction * 100) / 100;
  });

  const ltv = computeLtv(amount, collateralUsd);
  const health = healthState(ltv, vault.liquidationThreshold);
  const liqPrice = liquidationPrice(
    amount,
    holding.uiAmount,
    vault.liquidationThreshold,
  );
  const monthlyCost = monthlyBorrowCost(amount, vault.borrowRate);
  const validation = validateBorrow(
    amount,
    collateralUsd,
    vault,
    borrowTokenPrice,
  );
  const spotPrice = holding.price?.usdPrice ?? 0;
  const dropToLiquidation =
    liqPrice && spotPrice > 0 ? 1 - liqPrice / spotPrice : null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-label={`Borrow against ${holding.asset.symbol}`}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-t-2xl border sm:rounded-2xl"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-carbon)",
          maxHeight: "92vh",
        }}
      >
        <div className="overflow-y-auto px-6 py-7" style={{ maxHeight: "92vh" }}>
          <Header holding={holding} vault={vault} onClose={onClose} />

          <div className="mt-8">
            <div
              className="uppercase text-ash"
              style={{
                fontSize: "var(--text-caption)",
                letterSpacing: "var(--tracking-caption)",
              }}
            >
              Borrow
            </div>
            <div
              className="numeric-display mt-1"
              style={{
                fontFamily: "var(--font-aeonik)",
                fontSize: "clamp(36px, 10vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: "-1px",
              }}
            >
              <AnimatedNumber
                value={amount}
                duration={0.25}
                format={(v) => usd(v)}
              />
              <span className="text-ash" style={{ fontSize: "var(--text-body)" }}>
                {" "}
                {vault.borrowSymbol}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(maxBorrow, 0.01)}
              step={Math.max(maxBorrow / 200, 0.01)}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={busy || maxBorrow <= 0}
              aria-label={`Borrow amount in ${vault.borrowSymbol}`}
              className="mt-7 w-full cursor-pointer accent-(--color-signal-mint)"
            />

            <div className="mt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setAmount(0)}
                className="text-ash transition-colors hover:text-chalk"
                style={{ fontSize: "var(--text-caption)" }}
              >
                $0
              </button>
              <button
                type="button"
                onClick={() =>
                  setAmount(Math.floor(maxBorrow * 100) / 100)
                }
                className="text-ash transition-colors hover:text-chalk"
                style={{ fontSize: "var(--text-caption)" }}
              >
                Max {usd(maxBorrow)}
              </button>
            </div>
          </div>

          <div
            className="mt-8 rounded-card border"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--surface-abyss)",
            }}
          >
            <Row label="Collateral">
              <span className="numeric">
                {tokenAmount(holding.uiAmount)} {holding.asset.symbol}
              </span>
              <span className="text-ash"> · {usd(collateralUsd)}</span>
            </Row>
            <Row label="Loan to value">
              <span className="numeric">{percent(ltv)}</span>
              <span className="text-ash">
                {" "}
                of {percent(vault.maxLtv, 0)} max
              </span>
            </Row>
            <Row label="Health">
              <HealthPill state={health} />
            </Row>
            <Row label="Borrow rate">
              <span className="numeric">{percent(vault.borrowRate)} APR</span>
            </Row>
            <Row label="Est. cost">
              <span className="numeric">{usd(monthlyCost)}</span>
              <span className="text-ash"> / month</span>
            </Row>
            {/* Lead with the drop that triggers liquidation, not the absolute
                price. At a low LTV the raw figure ($11.96 against a $212 spot)
                is correct but reads as noise; "can fall 94%" is the number the
                user actually needs. */}
            <Row label="Liquidation if price falls" last>
              {liqPrice && dropToLiquidation !== null ? (
                <>
                  <span className="numeric">
                    {percent(dropToLiquidation, 0)}
                  </span>
                  <span className="text-ash"> · to {usd(liqPrice)}</span>
                </>
              ) : (
                <span className="text-ash">No debt — cannot be liquidated</span>
              )}
            </Row>
          </div>

          {/* Collateral is a market-hours asset: it can gap overnight while
              the oracle is frozen. Saying so is more credible than hiding it. */}
          <p
            className="mt-4 text-ash"
            style={{ fontSize: "var(--text-caption)" }}
          >
            {holding.asset.symbol} tracks a US-listed stock. Its price can move
            while markets are closed, so keep headroom above the liquidation
            price.
          </p>

          <AnimatePresence>
            {(error || validation.error) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden rounded-card px-4 py-3"
                style={{
                  background: "rgba(226, 92, 92, 0.1)",
                  color: "#e2917c",
                  fontSize: "var(--text-caption)",
                }}
              >
                {error ?? validation.error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            disabled={!validation.ok || busy}
            whileHover={validation.ok && !busy ? { scale: 1.01 } : undefined}
            whileTap={validation.ok && !busy ? { scale: 0.99 } : undefined}
            onClick={() =>
              onConfirm({
                vault,
                // Collateral is already in the wallet; deposit all of it so the
                // borrow is backed by the full position.
                collateralAmount: holding.uiAmount,
                borrowAmount: amount,
              })
            }
            className="mt-6 w-full py-4 text-abyss transition-opacity disabled:opacity-35"
            style={{
              borderRadius: "var(--radius-herobutton)",
              background: "var(--color-signal-mint)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            {busy
              ? "Preparing transaction…"
              : `Borrow ${usd(amount)} ${vault.borrowSymbol}`}
          </motion.button>

          <p
            className="mt-3 text-center text-ash"
            style={{ fontSize: "var(--text-caption)" }}
          >
            Your {holding.asset.symbol} stays yours. You can repay at any time.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Header({
  holding,
  vault,
  onClose,
}: {
  holding: Holding;
  vault: BorrowVault;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {holding.asset.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={holding.asset.logo}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        )}
        <div>
          <div
            style={{
              fontFamily: "var(--font-aeonik)",
              fontSize: "var(--text-subheading)",
            }}
          >
            Borrow against {holding.asset.symbol}
          </div>
          <div className="text-ash" style={{ fontSize: "var(--text-caption)" }}>
            Up to {percent(vault.maxLtv, 0)} of value · liquidation at{" "}
            {percent(vault.liquidationThreshold, 0)}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 rounded-full px-2 py-1 text-ash transition-colors hover:text-chalk"
        style={{ fontSize: "var(--text-subheading)" }}
      >
        ×
      </button>
    </div>
  );
}

function Row({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3.5"
      style={{
        borderBottom: last ? undefined : "1px solid var(--border-subtle)",
      }}
    >
      <span className="text-ash" style={{ fontSize: "var(--text-caption)" }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--text-caption)" }}>{children}</span>
    </div>
  );
}
