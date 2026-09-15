import { NextResponse } from "next/server";
import { fetchQuote, USDC_MINT } from "@/lib/jupiter/swap";
import { toRaw } from "@/lib/borrow-math";

export const dynamic = "force-dynamic";

/**
 * POST /api/swap/quote
 *
 * Quote a buy (USDC → xStock) or sell (xStock → USDC).
 *
 * Amounts arrive in UI units and are converted here, so the client never
 * has to reason about decimals.
 */
export async function POST(request: Request) {
  let body: {
    side?: "buy" | "sell";
    mint?: string;
    /** UI units of the input asset: USDC when buying, the stock when selling. */
    amount?: number;
    stockDecimals?: number;
    slippageBps?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const side = body.side ?? "buy";
  const mint = body.mint;
  const amount = Number(body.amount ?? 0);
  const stockDecimals = Number(body.stockDecimals ?? 8);

  if (!mint) {
    return NextResponse.json({ error: "Missing `mint`" }, { status: 400 });
  }
  if (!(amount > 0)) {
    return NextResponse.json({ error: "Enter an amount" }, { status: 400 });
  }

  try {
    const buying = side === "buy";
    const summary = await fetchQuote({
      inputMint: buying ? USDC_MINT : mint,
      outputMint: buying ? mint : USDC_MINT,
      amount: toRaw(amount, buying ? 6 : stockDecimals),
      outputDecimals: buying ? stockDecimals : 6,
      slippageBps: body.slippageBps,
    });

    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quote failed";
    console.error("[api/swap/quote]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
