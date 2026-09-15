const LEND_API = "https://lite-api.jup.ag/lend/v1";

/**
 * A Jupiter Earn market (a jlToken).
 *
 * Every market is a stablecoin or WSOL — there is no xStock market, so Earn
 * applies to the USDC a user borrows, not to their stocks.
 */
export interface EarnMarket {
  /** jlToken mint. */
  address: string;
  /** jlToken symbol, e.g. jlUSDC. */
  symbol: string;
  /** Underlying asset mint, e.g. USDC. */
  assetMint: string;
  assetSymbol: string;
  assetDecimals: number;
  assetLogo: string | null;
  /** Supply APY as a fraction, e.g. 0.0341. */
  supplyApy: number;
  /** Total supplied, raw base units. */
  totalAssetsRaw: string;
}

export interface EarnPosition {
  market: EarnMarket;
  /** Underlying asset currently supplied, UI units. */
  uiAmount: number;
  /** Value in USD, when the asset is dollar-denominated. */
  usdValue: number;
}

interface RawEarnToken {
  address?: string;
  symbol?: string;
  assetAddress?: string;
  asset?: {
    address?: string;
    symbol?: string;
    decimals?: number;
    logoUrl?: string;
    price?: string | number;
  };
  /** Basis points, e.g. 341 = 3.41%. */
  supplyRate?: string | number;
  totalAssets?: string | number;
}

function normalise(raw: RawEarnToken): EarnMarket | null {
  const asset = raw.asset;
  if (!raw.address || !asset?.address) return null;

  return {
    address: raw.address,
    symbol: raw.symbol ?? "",
    assetMint: asset.address,
    assetSymbol: asset.symbol ?? "",
    assetDecimals: asset.decimals ?? 6,
    assetLogo: asset.logoUrl ?? null,
    // Basis points, matching the borrow side.
    supplyApy: (Number(raw.supplyRate) || 0) / 1e4,
    totalAssetsRaw: String(raw.totalAssets ?? "0"),
  };
}

/** Fetch every Earn market, highest yield first. */
export async function fetchEarnMarkets(): Promise<EarnMarket[]> {
  const res = await fetch(`${LEND_API}/earn/tokens`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Jupiter Earn markets: HTTP ${res.status}`);

  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Earn markets: expected array");

  return json
    .map((t) => normalise(t as RawEarnToken))
    .filter((m): m is EarnMarket => m !== null)
    .sort((a, b) => b.supplyApy - a.supplyApy);
}

/** Fetch a wallet's open Earn positions. */
export async function fetchEarnPositions(
  wallet: string,
): Promise<EarnPosition[]> {
  const res = await fetch(
    `${LEND_API}/earn/positions?users=${encodeURIComponent(wallet)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];

  const json: unknown = await res.json();
  if (!Array.isArray(json)) return [];

  const positions: EarnPosition[] = [];
  for (const row of json as Array<{
    token?: RawEarnToken;
    // Underlying asset owed to the user, raw units.
    underlyingAssets?: string | number;
    shares?: string | number;
  }>) {
    const market = row.token ? normalise(row.token) : null;
    if (!market) continue;

    const raw = Number(row.underlyingAssets ?? 0);
    if (!raw) continue;

    const uiAmount = raw / 10 ** market.assetDecimals;
    const price = Number(row.token?.asset?.price) || 1;

    positions.push({ market, uiAmount, usdValue: uiAmount * price });
  }
  return positions;
}

/**
 * Build a signable deposit or withdraw transaction.
 *
 * Jupiter returns a complete v0 transaction, so it needs no assembly.
 */
export async function buildEarnTransaction(params: {
  action: "deposit" | "withdraw";
  assetMint: string;
  /** Raw base units of the underlying asset. */
  amount: bigint;
  signer: string;
}): Promise<{ transactionBase64: string }> {
  const res = await fetch(`${LEND_API}/earn/${params.action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      asset: params.assetMint,
      amount: params.amount.toString(),
      signer: params.signer,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      body.slice(0, 200) || `Could not build the ${params.action} (${res.status})`,
    );
  }

  const json = (await res.json()) as { transaction?: string };
  if (!json.transaction) {
    throw new Error(`Jupiter returned no ${params.action} transaction.`);
  }

  return { transactionBase64: json.transaction };
}
