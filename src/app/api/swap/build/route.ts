import { NextResponse } from "next/server";
import { buildSwapTransaction, type SwapQuote } from "@/lib/jupiter/swap";
import { parsePublicKey } from "@/lib/jupiter/operate";

export const dynamic = "force-dynamic";

/**
 * POST /api/swap/build
 *
 * Turn a quote into a signable transaction. The quote must be the object
 * returned by /api/swap/quote, unmodified — Jupiter encodes routing into it.
 */
export async function POST(request: Request) {
  let body: { wallet?: string; quote?: SwapQuote };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.wallet || !parsePublicKey(body.wallet)) {
    return NextResponse.json(
      { error: "Missing or invalid `wallet`" },
      { status: 400 },
    );
  }
  if (!body.quote?.outAmount) {
    return NextResponse.json({ error: "Missing `quote`" }, { status: 400 });
  }

  try {
    const built = await buildSwapTransaction({
      quote: body.quote,
      userPublicKey: body.wallet,
    });

    // Jupiter simulates before returning; a failure here would otherwise
    // only surface after the user had already signed.
    if (built.simulationError) {
      return NextResponse.json(
        {
          error: "This swap would fail on-chain",
          detail: built.simulationError,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(built);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build swap";
    console.error("[api/swap/build]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
