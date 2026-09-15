import { NextResponse } from "next/server";
import { getMarket } from "@/lib/market";

export const dynamic = "force-dynamic";

/**
 * GET /api/market
 *
 * The buyable xStock list, filtered to assets Jupiter can actually route to.
 */
export async function GET() {
  try {
    return NextResponse.json({ assets: await getMarket() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load market";
    console.error("[api/market]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
