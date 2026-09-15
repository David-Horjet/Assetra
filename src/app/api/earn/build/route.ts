import { NextResponse } from "next/server";
import { buildEarnTransaction, fetchEarnMarkets } from "@/lib/jupiter/earn";
import { parsePublicKey } from "@/lib/jupiter/operate";
import { toRaw } from "@/lib/borrow-math";

export const dynamic = "force-dynamic";

/**
 * POST /api/earn/build
 *
 * Build a signable supply or withdraw transaction for an Earn market.
 */
export async function POST(request: Request) {
  let body: {
    wallet?: string;
    assetMint?: string;
    amount?: number;
    action?: "deposit" | "withdraw";
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action ?? "deposit";
  const amount = Number(body.amount ?? 0);

  if (!body.wallet || !parsePublicKey(body.wallet)) {
    return NextResponse.json(
      { error: "Missing or invalid `wallet`" },
      { status: 400 },
    );
  }
  if (!body.assetMint) {
    return NextResponse.json({ error: "Missing `assetMint`" }, { status: 400 });
  }
  if (!(amount > 0)) {
    return NextResponse.json({ error: "Enter an amount" }, { status: 400 });
  }

  try {
    // Decimals come from the live market rather than the client, which must
    // never be trusted for unit conversion.
    const markets = await fetchEarnMarkets();
    const market = markets.find((m) => m.assetMint === body.assetMint);
    if (!market) {
      return NextResponse.json(
        { error: "No Earn market for this asset" },
        { status: 404 },
      );
    }

    const built = await buildEarnTransaction({
      action,
      assetMint: market.assetMint,
      amount: toRaw(amount, market.assetDecimals),
      signer: body.wallet,
    });

    return NextResponse.json({
      ...built,
      market: {
        assetSymbol: market.assetSymbol,
        supplyApy: market.supplyApy,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not build transaction";
    console.error("[api/earn/build]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
