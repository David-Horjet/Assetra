import type { XStockAsset } from "@/lib/types";

const XSTOCKS_API = "https://api.xstocks.fi/api/v1";

interface RawDeployment {
  address?: string;
  network?: string;
}

interface RawToken {
  symbol?: string;
  name?: string;
  underlyingSymbol?: string;
  logo?: string;
  isTradingHalted?: boolean;
  deployments?: RawDeployment[];
}

/** Solana addresses come back namespaced as `svm:<mint>`. */
function solanaMint(deployments: RawDeployment[] | undefined): string | null {
  const d = deployments?.find((x) => x.network === "Solana");
  if (!d?.address) return null;
  return d.address.replace(/^svm:/, "");
}

/**
 * Fetch the xStocks catalog (~849 tokens, ~834 with a Solana deployment).
 *
 * Metadata only — this endpoint carries no price. Pricing comes from
 * Jupiter (see lib/jupiter/prices.ts), which also supplies the scaled-UI
 * multiplier in the same response.
 */
export async function fetchXStockCatalog(): Promise<XStockAsset[]> {
  const res = await fetch(`${XSTOCKS_API}/token`, {
    // The catalog is near-static; refresh hourly.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`xStocks catalog: HTTP ${res.status}`);

  const json = (await res.json()) as { nodes?: RawToken[] };
  const nodes = json.nodes ?? [];

  const assets: XStockAsset[] = [];
  for (const t of nodes) {
    const mint = solanaMint(t.deployments);
    if (!mint || !t.symbol) continue;
    assets.push({
      symbol: t.symbol,
      name: t.name ?? t.symbol,
      underlyingSymbol: t.underlyingSymbol ?? t.symbol.replace(/x$/, ""),
      mint,
      logo: t.logo ?? null,
      isTradingHalted: Boolean(t.isTradingHalted),
    });
  }
  return assets;
}

/** Index the catalog by Solana mint for O(1) lookup against wallet balances. */
export function catalogByMint(
  assets: XStockAsset[],
): Map<string, XStockAsset> {
  return new Map(assets.map((a) => [a.mint, a]));
}
