import type { BorrowVault } from "@/lib/types";

const LEND_API = "https://lite-api.jup.ag/lend/v1";

/**
 * Scaling is NOT uniform across this payload — verified against live data:
 *
 *   collateralFactor     650 → 65%    per-mille  (/1e3)
 *   liquidationThreshold 750 → 75%    per-mille  (/1e3)
 *   liquidationPenalty   300 →  3%    basis pts  (/1e4)
 *   borrowRate          "458" → 4.58% basis pts  (/1e4), and a STRING
 *
 * Using one helper for all four silently turns a 3% penalty into 30%.
 */

/** Per-mille → fraction (650 → 0.65). Used for LTV and liquidation threshold. */
const perMille = (v: unknown): number => (Number(v) || 0) / 1e3;

/** Basis points → fraction (300 → 0.03). Used for penalty and rates. */
const basisPoints = (v: unknown): number => (Number(v) || 0) / 1e4;

interface RawVaultToken {
  address?: string;
  symbol?: string;
  decimals?: number;
}

interface RawVault {
  id?: number;
  address?: string;
  /** The API's name for the COLLATERAL token. */
  supplyToken?: RawVaultToken;
  borrowToken?: RawVaultToken;
  /** Max LTV in basis points. */
  collateralFactor?: number | string;
  liquidationThreshold?: number | string;
  liquidationPenalty?: number | string;
  borrowRate?: number | string;
  borrowable?: number | string;
  minimumBorrowing?: number | string;
  totalPositions?: number;
}

function normalise(raw: RawVault): BorrowVault | null {
  const col = raw.supplyToken;
  const bor = raw.borrowToken;
  if (!col?.address || !bor?.address || typeof raw.id !== "number") return null;

  return {
    id: raw.id,
    address: raw.address ?? "",
    collateralMint: col.address,
    collateralSymbol: col.symbol ?? "",
    collateralDecimals: col.decimals ?? 8,
    borrowMint: bor.address,
    borrowSymbol: bor.symbol ?? "",
    borrowDecimals: bor.decimals ?? 6,
    maxLtv: perMille(raw.collateralFactor),
    liquidationThreshold: perMille(raw.liquidationThreshold),
    liquidationPenalty: basisPoints(raw.liquidationPenalty),
    borrowRate: basisPoints(raw.borrowRate),
    borrowableRaw: String(raw.borrowable ?? "0"),
    minimumBorrowingRaw: String(raw.minimumBorrowing ?? "0"),
    totalPositions: Number(raw.totalPositions) || 0,
  };
}

/**
 * Fetch every live borrow vault.
 *
 * This is the single source of truth for which assets are actually
 * borrowable — the app never hardcodes a supported-asset list, so newly
 * added xStock vaults appear without a code change.
 */
export async function fetchAllVaults(): Promise<BorrowVault[]> {
  const res = await fetch(`${LEND_API}/borrow/vaults`, {
    // Vault params (rates, liquidity) drift slowly; a short cache keeps the
    // UI responsive without serving stale risk numbers.
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Jupiter Lend vaults: HTTP ${res.status}`);

  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Jupiter Lend vaults: expected array");

  return json
    .map((v) => normalise(v as RawVault))
    .filter((v): v is BorrowVault => v !== null);
}

/** Index vaults by collateral mint, best-LTV first. */
export function vaultsByCollateral(
  vaults: BorrowVault[],
): Map<string, BorrowVault[]> {
  const map = new Map<string, BorrowVault[]>();
  for (const v of vaults) {
    const list = map.get(v.collateralMint);
    if (list) list.push(v);
    else map.set(v.collateralMint, [v]);
  }
  // Prefer the highest LTV, then the deepest liquidity, so the default
  // vault offered to a user is the most useful one.
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        b.maxLtv - a.maxLtv ||
        Number(BigInt(b.borrowableRaw) > BigInt(a.borrowableRaw)) -
          Number(BigInt(b.borrowableRaw) < BigInt(a.borrowableRaw)),
    );
  }
  return map;
}
