import { PublicKey } from "@solana/web3.js";
import { balancesByMint, fetchTokenBalances } from "@/lib/balances";
import { fetchPrices } from "@/lib/jupiter/prices";
import { fetchAllVaults, vaultsByCollateral } from "@/lib/jupiter/vaults";
import { getConnection } from "@/lib/solana";
import { catalogByMint, fetchXStockCatalog } from "@/lib/xstocks";
import type { CapitalSummary, Holding, MarketStatus } from "@/lib/types";

/** USDC mint — the borrow asset, tracked separately from stock holdings. */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface PortfolioSnapshot {
  holdings: Holding[];
  capital: CapitalSummary;
  usdcBalance: number;
  marketStatus: MarketStatus;
  /** Set when a data source failed, so the UI can show honest degradation. */
  warning: string | null;
}

/**
 * Determine whether US equity markets are open.
 *
 * Jupiter Lend's oracle freezes outside regular trading hours, so this gates
 * how prices and 24h changes are presented. Regular session is
 * 09:30–16:00 America/New_York, Mon–Fri. Exchange holidays are not modelled;
 * the oracle timestamp below is the authoritative freshness signal.
 */
export function getMarketStatus(lastPriceAt: string | null): MarketStatus {
  const now = new Date();

  // Read wall-clock time in New York regardless of server timezone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));

  if (weekday === "Sat" || weekday === "Sun") {
    return { isOpen: false, reason: "Weekend", lastPriceAt };
  }

  const OPEN = 9 * 60 + 30;
  const CLOSE = 16 * 60;

  if (minutes < OPEN) {
    return { isOpen: false, reason: "Pre-market", lastPriceAt };
  }
  if (minutes >= CLOSE) {
    return { isOpen: false, reason: "After hours", lastPriceAt };
  }

  return { isOpen: true, reason: null, lastPriceAt };
}

/**
 * Build a complete portfolio view for a wallet.
 *
 * Holdings are valued from the RPC's multiplier-adjusted `uiAmount`, never
 * from raw amounts, and borrow support is derived from live Jupiter vaults
 * rather than any hardcoded asset list.
 */
export async function getPortfolio(
  walletAddress: string,
): Promise<PortfolioSnapshot> {
  const owner = new PublicKey(walletAddress);
  const connection = getConnection();

  const [balances, catalog, vaults] = await Promise.all([
    fetchTokenBalances(connection, owner),
    fetchXStockCatalog(),
    fetchAllVaults(),
  ]);

  const byMint = balancesByMint(balances);
  const assetsByMint = catalogByMint(catalog);
  const vaultMap = vaultsByCollateral(vaults);

  // Only price what the wallet actually holds and we can identify.
  const heldStockMints = [...byMint.keys()].filter((m) => assetsByMint.has(m));

  // Most xStocks have no on-chain liquidity and no price. Pricing all of them
  // is slow and mostly returns nothing, so prioritise the assets that matter:
  // anything with a lending vault first, then the rest up to a sane cap.
  const prioritised = [...heldStockMints].sort((a, b) => {
    const aHasVault = vaultMap.has(a) ? 0 : 1;
    const bHasVault = vaultMap.has(b) ? 0 : 1;
    return aHasVault - bHasVault;
  });
  const PRICE_LIMIT = 100;
  const toPrice = prioritised.slice(0, PRICE_LIMIT);

  const prices = await fetchPrices([...toPrice, USDC_MINT]);

  const holdings: Holding[] = [];
  for (const mint of heldStockMints) {
    const asset = assetsByMint.get(mint);
    const bal = byMint.get(mint);
    if (!asset || !bal) continue;

    const price = prices.get(mint) ?? null;

    // Skip dust and unpriceable positions — they add noise to the portfolio
    // without changing any number the user acts on.
    if (!price) continue;
    holdings.push({
      asset,
      price,
      uiAmount: bal.uiAmount,
      rawAmount: bal.rawAmount,
      decimals: bal.decimals,
      usdValue: price ? bal.uiAmount * price.usdPrice : null,
      vaults: vaultMap.get(mint) ?? [],
    });
  }

  // Borrowable assets first, then by value. The product is about what your
  // capital can *do*, so an asset with a lending market outranks a larger
  // one the user cannot act on.
  holdings.sort((a, b) => {
    const aBorrowable = a.vaults.length > 0 ? 0 : 1;
    const bBorrowable = b.vaults.length > 0 ? 0 : 1;
    if (aBorrowable !== bBorrowable) return aBorrowable - bBorrowable;
    return (b.usdValue ?? 0) - (a.usdValue ?? 0);
  });

  const usdcBalance = byMint.get(USDC_MINT)?.uiAmount ?? 0;

  // Every stock holding is idle until borrow positions are wired in
  // (Phase 2). Collateralised value moves into `workingUsd` there.
  const totalUsd = holdings.reduce((sum, h) => sum + (h.usdValue ?? 0), 0);

  const capital: CapitalSummary = {
    totalUsd,
    workingUsd: 0,
    idleUsd: totalUsd,
    borrowedUsd: 0,
  };

  // Freshest underlying-equity timestamp across held assets.
  const lastPriceAt =
    holdings
      .map((h) => h.price?.stockUpdatedAt)
      .filter((t): t is string => Boolean(t))
      .sort()
      .pop() ?? null;

  // Holdings we could identify but not price are excluded from valuation
  // rather than shown at zero, which would understate the portfolio.
  const hidden = heldStockMints.length - holdings.length;

  return {
    holdings,
    capital,
    usdcBalance,
    marketStatus: getMarketStatus(lastPriceAt),
    warning:
      hidden > 0
        ? `${hidden} holding${hidden === 1 ? "" : "s"} hidden — no market price available`
        : null,
  };
}
