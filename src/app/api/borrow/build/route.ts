import { NextResponse } from "next/server";
import {
  buildOperateTransaction,
  parsePublicKey,
  simulateOperate,
} from "@/lib/jupiter/operate";
import { fetchAllVaults } from "@/lib/jupiter/vaults";
import { getConnection } from "@/lib/solana";
import { toRaw } from "@/lib/borrow-math";

export const dynamic = "force-dynamic";

interface BuildRequest {
  wallet?: string;
  vaultId?: number;
  /** Existing position id; 0 or omitted opens a new position. */
  positionId?: number;
  /** Collateral to deposit, in UI units (e.g. 0.5 NVDAx). */
  collateralAmount?: number;
  /** Debt to borrow, in UI units (e.g. 250 USDC). */
  borrowAmount?: number;
}

/**
 * POST /api/borrow/build
 *
 * Builds an unsigned v0 transaction that deposits collateral and borrows
 * against it, then simulates it so a failure surfaces in the preview rather
 * than after the user has signed.
 *
 * The server never holds a key — the wallet signs the returned transaction.
 */
export async function POST(request: Request) {
  let body: BuildRequest;
  try {
    body = (await request.json()) as BuildRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { wallet, vaultId, positionId = 0 } = body;
  const collateralAmount = Number(body.collateralAmount ?? 0);
  const borrowAmount = Number(body.borrowAmount ?? 0);

  const signer = wallet ? parsePublicKey(wallet) : null;
  if (!signer) {
    return NextResponse.json(
      { error: "Missing or invalid `wallet`" },
      { status: 400 },
    );
  }

  if (typeof vaultId !== "number") {
    return NextResponse.json({ error: "Missing `vaultId`" }, { status: 400 });
  }

  if (collateralAmount <= 0 && borrowAmount <= 0) {
    return NextResponse.json(
      { error: "Nothing to do: provide a collateral or borrow amount" },
      { status: 400 },
    );
  }

  try {
    // Resolve the vault so decimals and the protocol minimum come from live
    // state rather than the client, which must never be trusted for these.
    const vaults = await fetchAllVaults();
    const vault = vaults.find((v) => v.id === vaultId);
    if (!vault) {
      return NextResponse.json(
        { error: `Vault ${vaultId} is not available` },
        { status: 404 },
      );
    }

    const collateralRaw = toRaw(collateralAmount, vault.collateralDecimals);
    const debtRaw = toRaw(borrowAmount, vault.borrowDecimals);

    // A borrow below the protocol minimum fails on-chain with an opaque
    // error, so reject it here with a message the user can act on.
    const minRaw = BigInt(vault.minimumBorrowingRaw);
    if (debtRaw > 0n && debtRaw < minRaw) {
      const minUi = Number(minRaw) / 10 ** vault.borrowDecimals;
      return NextResponse.json(
        {
          error: `Minimum borrow is ${minUi.toFixed(2)} ${vault.borrowSymbol}`,
        },
        { status: 400 },
      );
    }

    const connection = getConnection();
    const built = await buildOperateTransaction({
      connection,
      signer,
      vaultId,
      positionId,
      collateralRaw,
      debtRaw,
    });

    const simulation = await simulateOperate(
      connection,
      built.transactionBase64,
    );

    if (!simulation.ok) {
      return NextResponse.json(
        {
          error: "This transaction would fail on-chain",
          detail: simulation.error,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ...built,
      vault: {
        id: vault.id,
        collateralSymbol: vault.collateralSymbol,
        borrowSymbol: vault.borrowSymbol,
        maxLtv: vault.maxLtv,
        liquidationThreshold: vault.liquidationThreshold,
        borrowRate: vault.borrowRate,
      },
      simulation: { unitsConsumed: simulation.unitsConsumed },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build transaction";
    console.error("[api/borrow/build]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
