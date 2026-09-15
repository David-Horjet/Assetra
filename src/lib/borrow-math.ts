import type { BorrowVault, HealthState } from "@/lib/types";

/**
 * Pure borrow math. No network, no React — every function here is
 * synchronous and total, so the borrow slider can recompute on each frame
 * and the numbers stay trivially testable.
 */

/** Convert a UI amount to raw base units without float drift. */
export function toRaw(uiAmount: number, decimals: number): bigint {
  if (!Number.isFinite(uiAmount) || uiAmount <= 0) return 0n;
  // Round through a fixed-decimal string: 0.1 + 0.2 style error at 8dp
  // otherwise produces off-by-one base units.
  const [whole = "0", frac = ""] = uiAmount.toFixed(decimals).split(".");
  return BigInt(whole + frac.padEnd(decimals, "0").slice(0, decimals));
}

/** Convert raw base units to a UI number. */
export function fromRaw(raw: bigint | string, decimals: number): number {
  const v = typeof raw === "string" ? BigInt(raw || "0") : raw;
  return Number(v) / 10 ** decimals;
}

/**
 * Maximum borrowable, in USD, against a collateral position.
 *
 * Capped by both the vault's LTV and its remaining liquidity — a vault can
 * advertise 65% LTV while having almost nothing left to lend.
 */
export function maxBorrowUsd(
  collateralUsd: number,
  vault: BorrowVault,
  borrowTokenUsdPrice: number,
): number {
  if (collateralUsd <= 0) return 0;

  const byLtv = collateralUsd * vault.maxLtv;
  const availableUsd =
    fromRaw(vault.borrowableRaw, vault.borrowDecimals) * borrowTokenUsdPrice;

  return Math.max(0, Math.min(byLtv, availableUsd));
}

/** Loan-to-value as a fraction. Returns 0 when there is no collateral. */
export function computeLtv(debtUsd: number, collateralUsd: number): number {
  if (collateralUsd <= 0) return 0;
  return debtUsd / collateralUsd;
}

/**
 * Classify risk by how close LTV sits to the liquidation threshold.
 *
 * Thresholds are expressed as a fraction of the way to liquidation, so they
 * stay meaningful across vaults with different parameters.
 */
export function healthState(
  ltv: number,
  liquidationThreshold: number,
): HealthState {
  if (ltv <= 0 || liquidationThreshold <= 0) return "healthy";

  const proximity = ltv / liquidationThreshold;
  if (proximity < 0.5) return "healthy";
  if (proximity < 0.75) return "moderate";
  if (proximity < 0.9) return "at-risk";
  return "critical";
}

/**
 * The collateral price at which the position is liquidated.
 *
 * Below this price the debt breaches the liquidation threshold. Returns null
 * when there is no debt (nothing to liquidate).
 */
export function liquidationPrice(
  debtUsd: number,
  collateralUiAmount: number,
  liquidationThreshold: number,
): number | null {
  if (debtUsd <= 0 || collateralUiAmount <= 0) return null;
  return debtUsd / (collateralUiAmount * liquidationThreshold);
}

/** Simple (non-compounding) interest projection for the borrow preview. */
export function monthlyBorrowCost(debtUsd: number, borrowRate: number): number {
  if (debtUsd <= 0 || borrowRate <= 0) return 0;
  return (debtUsd * borrowRate) / 12;
}

export interface BorrowValidation {
  ok: boolean;
  /** User-facing reason the borrow cannot proceed. */
  error: string | null;
}

/**
 * Validate a borrow before building a transaction.
 *
 * The protocol minimum matters most: a sub-minimum borrow fails on-chain
 * with an opaque error, so it must be caught in the UI.
 */
export function validateBorrow(
  borrowUsd: number,
  collateralUsd: number,
  vault: BorrowVault,
  borrowTokenUsdPrice: number,
): BorrowValidation {
  if (borrowUsd <= 0) return { ok: false, error: null };

  const minUsd =
    fromRaw(vault.minimumBorrowingRaw, vault.borrowDecimals) *
    borrowTokenUsdPrice;

  if (borrowUsd < minUsd) {
    return {
      ok: false,
      error: `Minimum borrow is ${minUsd.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })}`,
    };
  }

  const max = maxBorrowUsd(collateralUsd, vault, borrowTokenUsdPrice);
  if (borrowUsd > max) {
    return { ok: false, error: "Exceeds available borrowing capacity" };
  }

  return { ok: true, error: null };
}
