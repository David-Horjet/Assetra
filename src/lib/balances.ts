import { Connection, PublicKey } from "@solana/web3.js";

/** Token-2022 program — xStocks are Token-2022, not the legacy SPL program. */
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

/** Legacy SPL Token program — USDC and most other tokens. */
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

export interface TokenBalance {
  mint: string;
  /**
   * Multiplier-adjusted balance as reported by the RPC.
   *
   * For xStocks this already includes the Token-2022 scaled-UI multiplier —
   * it is the economically correct number. Never recompute it from
   * `rawAmount / 10 ** decimals`, which ignores the multiplier and
   * under-reports every holding.
   */
  uiAmount: number;
  /** Base units, as a string to avoid float precision loss. */
  rawAmount: string;
  decimals: number;
}

function parseAccounts(
  value: Array<{ account: { data: { parsed?: { info?: unknown } } } }>,
): TokenBalance[] {
  const out: TokenBalance[] = [];

  for (const { account } of value) {
    const info = account.data.parsed?.info as
      | {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
            uiAmount?: number | null;
            uiAmountString?: string;
          };
        }
      | undefined;

    const mint = info?.mint;
    const amt = info?.tokenAmount;
    if (!mint || !amt) continue;

    // Prefer uiAmountString: it is exact for scaled-UI mints, where
    // uiAmount is a lossy float.
    const ui =
      amt.uiAmountString !== undefined
        ? Number(amt.uiAmountString)
        : (amt.uiAmount ?? 0);

    if (!Number.isFinite(ui) || ui <= 0) continue;

    out.push({
      mint,
      uiAmount: ui,
      rawAmount: amt.amount ?? "0",
      decimals: amt.decimals ?? 0,
    });
  }
  return out;
}

/**
 * Read every positive token balance for a wallet across both token programs.
 *
 * Queries Token-2022 (xStocks) and legacy SPL (USDC) since a portfolio spans
 * both, and returns them merged.
 */
export async function fetchTokenBalances(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenBalance[]> {
  const [t22, spl] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
  ]);

  return [...parseAccounts(t22.value), ...parseAccounts(spl.value)];
}

/** Index balances by mint. Duplicate accounts for one mint are summed. */
export function balancesByMint(
  balances: TokenBalance[],
): Map<string, TokenBalance> {
  const map = new Map<string, TokenBalance>();
  for (const b of balances) {
    const existing = map.get(b.mint);
    if (!existing) {
      map.set(b.mint, { ...b });
      continue;
    }
    existing.uiAmount += b.uiAmount;
    existing.rawAmount = (
      BigInt(existing.rawAmount) + BigInt(b.rawAmount)
    ).toString();
  }
  return map;
}
