import { fetchPrices } from "@/lib/jupiter/prices";
import { fetchAllVaults, vaultsByCollateral } from "@/lib/jupiter/vaults";
import { catalogByMint, fetchXStockCatalog } from "@/lib/xstocks";
import type { AssetPrice, BorrowVault, XStockAsset } from "@/lib/types";

/**
 * A stock offered in the buy list.
 *
 * Only assets Jupiter can actually route to are listed — showing an
 * untradeable ticker produces a "no route" failure at signing time, which is
 * a far worse experience than not offering it.
 */
export interface MarketAsset {
  asset: XStockAsset;
  price: AssetPrice;
  /** Pool depth in USD. Drives ordering and the thin-market warning. */
  liquidity: number;
  /** Lending vaults, empty when the asset cannot be used as collateral. */
  vaults: BorrowVault[];
}

/**
 * Minimum pool depth to list an asset.
 *
 * Below roughly this level a $50 order moves the price enough that the quote
 * is misleading.
 */
const MIN_LIQUIDITY_USD = 25_000;

/** Cap the list so the UI stays browsable rather than exhaustive. */
const MAX_ASSETS = 60;

/**
 * The buyable market.
 *
 * Of ~834 xStocks on Solana only a minority have a live Jupiter price and
 * usable depth, so the catalog is filtered against real routing data rather
 * than published to the user wholesale.
 */
export async function getMarket(): Promise<MarketAsset[]> {
  const [catalog, vaults] = await Promise.all([
    fetchXStockCatalog(),
    fetchAllVaults(),
  ]);

  const tradeable = catalog.filter((a) => !a.isTradingHalted);
  const prices = await fetchPrices(tradeable.map((a) => a.mint));
  const vaultMap = vaultsByCollateral(vaults);
  const byMint = catalogByMint(tradeable);

  const market: MarketAsset[] = [];
  for (const [mint, price] of prices) {
    const asset = byMint.get(mint);
    if (!asset) continue;

    const liquidity = price.liquidity ?? 0;
    if (liquidity < MIN_LIQUIDITY_USD) continue;

    market.push({
      asset,
      price,
      liquidity,
      vaults: vaultMap.get(mint) ?? [],
    });
  }

  // Borrowable first — those are the assets the product is actually about —
  // then by depth, which correlates with recognisability.
  market.sort((a, b) => {
    const aVault = a.vaults.length > 0 ? 0 : 1;
    const bVault = b.vaults.length > 0 ? 0 : 1;
    if (aVault !== bVault) return aVault - bVault;
    return b.liquidity - a.liquidity;
  });

  return market.slice(0, MAX_ASSETS);
}
