/**
 * Core domain types for Assetra.
 *
 * Money rule: every *value* field is a USD number for display. Every *raw*
 * field is base units as a string (never a JS number — 8-decimal xStock
 * amounts overflow float precision at large sizes).
 */

/** An xStock asset as published by the xStocks catalog. */
export interface XStockAsset {
  symbol: string;
  name: string;
  /** Underlying ticker, e.g. NVDA for NVDAx. */
  underlyingSymbol: string;
  /** Solana mint (the `svm:` prefix is stripped at the boundary). */
  mint: string;
  logo: string | null;
  isTradingHalted: boolean;
}

/** Live pricing from Jupiter, including the Token-2022 scaled-UI multiplier. */
export interface AssetPrice {
  mint: string;
  usdPrice: number;
  priceChange24h: number | null;
  decimals: number;
  /** Depth on the execution venue; used to warn on thin markets. */
  liquidity: number | null;
  /**
   * Scaled-UI multiplier as reported by Jupiter — DISPLAY METADATA ONLY.
   *
   * Verified stale on mainnet: it kept reporting the superseded value days
   * after the mint's `newMultiplier` took effect. Using it for balance or
   * collateral math understates holdings.
   *
   * Balances must come from the RPC's `uiAmountString`, which applies the
   * currently active multiplier. See findings.md §10.
   */
  staleMultiplierForDisplay: number | null;
  /** When the underlying equity price last moved. Drives market-closed state. */
  stockUpdatedAt: string | null;
}

/**
 * A Jupiter Lend borrow vault.
 *
 * NOTE: the API calls the collateral side `supplyToken` and max LTV
 * `collateralFactor` (in basis points). Names here are normalised to what the
 * product actually means, so UI code never re-learns that mapping.
 */
export interface BorrowVault {
  id: number;
  address: string;
  /** Collateral side — the xStock. */
  collateralMint: string;
  collateralSymbol: string;
  collateralDecimals: number;
  /** Debt side — USDC or JupUSD. */
  borrowMint: string;
  borrowSymbol: string;
  borrowDecimals: number;
  /** Max LTV as a fraction, e.g. 0.65. */
  maxLtv: number;
  /** Liquidation threshold as a fraction, e.g. 0.75. */
  liquidationThreshold: number;
  /** Liquidation penalty as a fraction, e.g. 0.03. */
  liquidationPenalty: number;
  /** Annualised borrow rate as a fraction, e.g. 0.055. */
  borrowRate: number;
  /** Remaining borrowable liquidity, raw base units of the borrow token. */
  borrowableRaw: string;
  /** Protocol minimum debt, raw base units. Borrows below this fail on-chain. */
  minimumBorrowingRaw: string;
  totalPositions: number;
}

/** A wallet's holding of one xStock, valued. */
export interface Holding {
  asset: XStockAsset;
  price: AssetPrice | null;
  /**
   * Multiplier-adjusted balance, straight from the RPC's `uiAmount`.
   * Never derived from raw / 10**decimals.
   */
  uiAmount: number;
  rawAmount: string;
  decimals: number;
  /** uiAmount * usdPrice. Null when price is unavailable. */
  usdValue: number | null;
  /** Vaults where this asset can be used as collateral. Empty = not supported. */
  vaults: BorrowVault[];
}

/** An open borrow position against a vault. */
export interface Position {
  vaultId: number;
  positionId: number;
  collateralUiAmount: number;
  collateralUsd: number;
  debtUiAmount: number;
  debtUsd: number;
  /** debtUsd / collateralUsd. 0 when there is no collateral. */
  ltv: number;
  health: HealthState;
}

export type HealthState = "healthy" | "moderate" | "at-risk" | "critical";

/** Portfolio-level capital split — the product's central concept. */
export interface CapitalSummary {
  totalUsd: number;
  /** Value deposited as collateral. */
  workingUsd: number;
  /** Value sitting in the wallet doing nothing. */
  idleUsd: number;
  /** Outstanding debt across positions. */
  borrowedUsd: number;
}

/** Whether US equity markets are open, which gates oracle freshness. */
export interface MarketStatus {
  isOpen: boolean;
  /** Human-readable reason when closed, e.g. "Weekend". */
  reason: string | null;
  /** ISO timestamp of the last known price movement. */
  lastPriceAt: string | null;
}
