import { NextResponse } from "next/server";
import { getPortfolio } from "@/lib/portfolio";
import { parsePublicKey } from "@/lib/jupiter/operate";

/** Portfolio reads hit the RPC directly and must not be statically cached. */
export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio?wallet=<address>
 *
 * Returns holdings, capital split and market status for a wallet. Runs
 * server-side so the RPC key stays out of the client bundle.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "Missing `wallet` query parameter" },
      { status: 400 },
    );
  }

  if (!parsePublicKey(wallet)) {
    return NextResponse.json(
      { error: "Invalid Solana address" },
      { status: 400 },
    );
  }

  try {
    const snapshot = await getPortfolio(wallet);
    return NextResponse.json(snapshot);
  } catch (err) {
    // Surface the real reason — a silent empty portfolio would look like the
    // wallet holds nothing, which is a materially different message.
    const message =
      err instanceof Error ? err.message : "Failed to load portfolio";
    console.error("[api/portfolio]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
