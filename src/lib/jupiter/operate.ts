import { getOperateIx } from "@jup-ag/lend/borrow";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

/**
 * Jupiter Lend vault operations.
 *
 * `getOperateIx` is a single primitive covering all four actions through the
 * signs of its two amounts:
 *
 *   borrow    colAmount > 0   debtAmount > 0
 *   repay     colAmount = 0   debtAmount < 0
 *   add col   colAmount > 0   debtAmount = 0
 *   withdraw  colAmount < 0   debtAmount = 0
 *
 * Amounts are raw base units (xStocks 8dp, USDC 6dp).
 */

export interface OperateParams {
  connection: Connection;
  signer: PublicKey;
  vaultId: number;
  /** 0 opens a new position; otherwise an existing position id. */
  positionId: number;
  /** Collateral delta, raw base units. Positive deposits. */
  collateralRaw: bigint;
  /** Debt delta, raw base units. Positive borrows, negative repays. */
  debtRaw: bigint;
}

export interface BuiltTransaction {
  /** Base64 v0 transaction, ready for the wallet to sign. */
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  /** Position the operation targets; 0 means a new one is being created. */
  positionId: number;
}

/**
 * Priority fee. Vault operations are compute-heavy and a stalled demo
 * transaction is far more costly than a fraction of a cent.
 */
const PRIORITY_FEE_MICROLAMPORTS = 200_000;
const COMPUTE_UNIT_LIMIT = 600_000;

/** BN has no bigint constructor; go via string to stay exact. */
const toBN = (v: bigint): BN => new BN(v.toString());

/**
 * Build an unsigned v0 transaction for a vault operation.
 *
 * Runs server-side: the SDK pulls in Anchor and Node polyfills that do not
 * belong in a browser bundle, and the RPC key must never reach the client.
 * The user's wallet signs the returned transaction, so no private key is
 * ever handled here.
 */
export async function buildOperateTransaction({
  connection,
  signer,
  vaultId,
  positionId,
  collateralRaw,
  debtRaw,
}: OperateParams): Promise<BuiltTransaction> {
  const { ixs, addressLookupTableAccounts, nftId } = await getOperateIx({
    vaultId,
    positionId,
    colAmount: toBN(collateralRaw),
    debtAmount: toBN(debtRaw),
    connection,
    signer,
    market: "main",
    // A first-time borrower has no USDC token account yet.
    includeATASetup: true,
  });

  if (!ixs || ixs.length === 0) {
    throw new Error(
      "Jupiter Lend returned no instructions. The vault id or position may be invalid.",
    );
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  // Vault operations touch well over 32 accounts, so this only fits as a v0
  // transaction with the SDK's lookup tables — legacy will not serialise.
  const message = new TransactionMessage({
    payerKey: signer,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: PRIORITY_FEE_MICROLAMPORTS,
      }),
      ...ixs,
    ],
  }).compileToV0Message(addressLookupTableAccounts ?? []);

  const tx = new VersionedTransaction(message);

  return {
    transactionBase64: Buffer.from(tx.serialize()).toString("base64"),
    blockhash,
    lastValidBlockHeight,
    positionId: nftId ?? positionId,
  };
}

/**
 * Simulate an operation without signing.
 *
 * Used to surface a real on-chain failure (insufficient collateral, breached
 * minimum debt, exhausted vault liquidity) in the preview, before the user is
 * asked to sign anything.
 */
export async function simulateOperate(
  connection: Connection,
  transactionBase64: string,
): Promise<{ ok: boolean; error: string | null; unitsConsumed: number | null }> {
  const tx = VersionedTransaction.deserialize(
    Buffer.from(transactionBase64, "base64"),
  );

  const sim = await connection.simulateTransaction(tx, {
    replaceRecentBlockhash: true,
    // The transaction is deliberately unsigned at this stage.
    sigVerify: false,
  });

  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    // Program error logs are far more actionable than the raw err object.
    const reason =
      logs.find((l) => /Error|failed|insufficient/i.test(l)) ??
      JSON.stringify(sim.value.err);
    return { ok: false, error: reason, unitsConsumed: sim.value.unitsConsumed ?? null };
  }

  return { ok: true, error: null, unitsConsumed: sim.value.unitsConsumed ?? null };
}

/** Parse a base58 address, returning null rather than throwing. */
export function parsePublicKey(value: string): PublicKey | null {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}
