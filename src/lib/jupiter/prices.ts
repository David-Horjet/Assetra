import type { AssetPrice } from "@/lib/types";

const PRICE_API = "https://lite-api.jup.ag/price/v3";

/** The endpoint accepts a bounded id list; chunk to stay well inside it. */
const CHUNK = 50;

interface RawPrice {
  usdPrice?: number;
  priceChange24h?: number;
  decimals?: number;
  liquidity?: number;
  stockData?: { updatedAt?: string };
  scaledUiConfig?: { multiplier?: number };
}

async function fetchChunk(mints: string[]): Promise<Map<string, AssetPrice>> {
  const res = await fetch(`${PRICE_API}?ids=${mints.join(",")}`, {
    // Prices move constantly; cache only long enough to collapse the burst of
    // requests a single page render produces.
    next: { revalidate: 15 },
  });
  if (!res.ok) throw new Error(`Jupiter price: HTTP ${res.status}`);

  const json = (await res.json()) as Record<string, RawPrice | null>;
  const out = new Map<string, AssetPrice>();

  for (const [mint, raw] of Object.entries(json)) {
    if (!raw || typeof raw.usdPrice !== "number") continue;
    out.set(mint, {
      mint,
      usdPrice: raw.usdPrice,
      priceChange24h:
        typeof raw.priceChange24h === "number" ? raw.priceChange24h : null,
      decimals: raw.decimals ?? 8,
      liquidity: typeof raw.liquidity === "number" ? raw.liquidity : null,
      // Deliberately NOT used for balance math — see the field's doc comment.
      staleMultiplierForDisplay: raw.scaledUiConfig?.multiplier ?? null,
      stockUpdatedAt: raw.stockData?.updatedAt ?? null,
    });
  }
  return out;
}

/**
 * Fetch USD prices for the given mints.
 *
 * One call returns price, 24h change, liquidity and the Token-2022 scaled-UI
 * multiplier together, so no separate oracle or multiplier lookup is needed.
 *
 * Missing mints are simply absent from the map — callers must handle a null
 * price rather than assuming every request resolves.
 */
export async function fetchPrices(
  mints: string[],
): Promise<Map<string, AssetPrice>> {
  const unique = [...new Set(mints)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    chunks.push(unique.slice(i, i + CHUNK));
  }

  const results = await Promise.all(chunks.map(fetchChunk));
  const merged = new Map<string, AssetPrice>();
  for (const r of results) for (const [k, v] of r) merged.set(k, v);
  return merged;
}
