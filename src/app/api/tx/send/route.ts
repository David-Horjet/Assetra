import { VersionedTransaction } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { explorerTx, getConnection } from "@/lib/solana";

export const dynamic = "force-dynamic";

interface SendRequest {
  /** Base64 transaction, already signed by the user's wallet. */
  signedTransaction?: string;
  blockhash?: string;
  lastValidBlockHeight?: number;
}

/**
 * POST /api/tx/send
 *
 * Submits a wallet-signed transaction and waits for confirmation. Shared by
 * every flow — buy, borrow, repay and earn — since submission is identical
 * once a transaction is signed.
 *
 * Runs server-side to use the paid RPC: public endpoints drop transactions
 * under load, which is exactly when a demo fails. The transaction arrives
 * already signed; the server only relays it.
 */
export async function POST(request: Request) {
  let body: SendRequest;
  try {
    body = (await request.json()) as SendRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { signedTransaction, blockhash, lastValidBlockHeight } = body;

  if (!signedTransaction) {
    return NextResponse.json(
      { error: "Missing `signedTransaction`" },
      { status: 400 },
    );
  }

  try {
    const connection = getConnection();
    const raw = Buffer.from(signedTransaction, "base64");

    // Deserialize first so a malformed payload fails here rather than
    // surfacing as an opaque RPC error.
    VersionedTransaction.deserialize(raw);

    const signature = await connection.sendRawTransaction(raw, {
      // Already simulated at build time; re-running wastes a round trip and
      // can spuriously fail on a slightly stale blockhash.
      skipPreflight: true,
      maxRetries: 3,
    });

    const confirmation =
      blockhash && lastValidBlockHeight
        ? await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed",
          )
        : await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      return NextResponse.json(
        {
          error: "Transaction failed on-chain",
          detail: JSON.stringify(confirmation.value.err),
          signature,
          explorerUrl: explorerTx(signature),
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      signature,
      explorerUrl: explorerTx(signature),
      confirmed: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit transaction";
    console.error("[api/tx/send]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
