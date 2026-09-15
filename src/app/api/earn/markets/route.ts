import { NextResponse } from "next/server";
import { fetchEarnMarkets, fetchEarnPositions } from "@/lib/jupiter/earn";
import { parsePublicKey } from "@/lib/jupiter/operate";

export const dynamic = "force-dynamic";

/**
 * GET /api/earn/markets?wallet=<address>
 *
 * Earn markets, plus the wallet's open positions when an address is given.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  try {
    const [markets, positions] = await Promise.all([
      fetchEarnMarkets(),
      wallet && parsePublicKey(wallet)
        ? fetchEarnPositions(wallet)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ markets, positions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load markets";
    console.error("[api/earn/markets]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
