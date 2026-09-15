"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Sheet, SheetRow } from "@/components/Sheet";
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
    <Sheet
      title={`Borrow against ${holding.asset.symbol}`}
      subtitle={`Up to ${percent(vault.maxLtv, 0)} of value · liquidation at ${percent(vault.liquidationThreshold, 0)}`}
      logo={holding.asset.logo}
      onClose={onClose}
    >
      <div>
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
        <SheetRow label="Collateral">
          <span className="numeric">
            {tokenAmount(holding.uiAmount)} {holding.asset.symbol}
          </span>
          <span className="text-ash"> · {usd(collateralUsd)}</span>
        </SheetRow>
        <SheetRow label="Loan to value">
          <span className="numeric">{percent(ltv)}</span>
          <span className="text-ash">
            {" "}
            of {percent(vault.maxLtv, 0)} max
          </span>
        </SheetRow>
        <SheetRow label="Health">
          <HealthPill state={health} />
        </SheetRow>
        <SheetRow label="Borrow rate">
          <span className="numeric">{percent(vault.borrowRate)} APR</span>
        </SheetRow>
        <SheetRow label="Est. cost">
          <span className="numeric">{usd(monthlyCost)}</span>
          <span className="text-ash"> / month</span>
        </SheetRow>
        {/* Lead with the drop that triggers liquidation, not the absolute
            price. At a low LTV the raw figure ($11.96 against a $212 spot)
            is correct but reads as noise; "can fall 94%" is the number the
            user actually needs. */}
        <SheetRow label="Liquidation if price falls" last>
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
        </SheetRow>
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
    </Sheet>
  );
}
