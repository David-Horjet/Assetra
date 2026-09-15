const SWAP_API = "https://lite-api.jup.ag/swap/v1";

/** USDC is the quote asset for every buy and sell in the app. */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * A Jupiter quote.
 *
 * Passed back to the swap endpoint verbatim — Jupiter signs routing details
 * into it, so reconstructing the object invalidates the route.
 */
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  /** Worst-case output after slippage. */
  otherAmountThreshold: string;
  priceImpactPct: string;
  swapUsdValue?: string;
  routePlan?: Array<{ swapInfo?: { label?: string }; percent?: number }>;
  [key: string]: unknown;
}

export interface QuoteSummary {
  quote: SwapQuote;
  /** Output in UI units, e.g. 0.0655 SPYx. */
  outUiAmount: number;
  /** Minimum output after slippage, UI units. */
  minOutUiAmount: number;
  /** Price impact as a fraction, e.g. 0.00017. */
  priceImpact: number;
  /** Venues the route passes through, for disclosure. */
  route: string[];
  usdValue: number | null;
}

/** Default slippage: 1%. xStock pools are thinner than major pairs. */
export const DEFAULT_SLIPPAGE_BPS = 100;

/**
 * Quote a swap.
 *
 * `amount` is in raw base units of the input mint.
 */
export async function fetchQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps?: number;
  outputDecimals: number;
}): Promise<QuoteSummary> {
  const { inputMint, outputMint, amount, outputDecimals } = params;
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

  const url =
    `${SWAP_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amount.toString()}&slippageBps=${slippageBps}`;

  // Quotes are priced per request and go stale within seconds — never cache.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      /no route|not found/i.test(body)
        ? "No route available for this trade right now."
        : `Jupiter quote failed (${res.status})`,
    );
  }

  const quote = (await res.json()) as SwapQuote;
  const divisor = 10 ** outputDecimals;

  return {
    quote,
    outUiAmount: Number(quote.outAmount) / divisor,
    minOutUiAmount: Number(quote.otherAmountThreshold) / divisor,
    priceImpact: Number(quote.priceImpactPct) || 0,
    route:
      quote.routePlan
        ?.map((r) => r.swapInfo?.label)
        .filter((l): l is string => Boolean(l)) ?? [],
    usdValue: quote.swapUsdValue ? Number(quote.swapUsdValue) : null,
  };
}

export interface BuiltSwap {
  transactionBase64: string;
  lastValidBlockHeight: number | null;
  /** Jupiter simulates before returning; non-null means it would fail. */
  simulationError: string | null;
}

/**
 * Build a signable swap transaction from a quote.
 *
 * Jupiter returns a complete v0 transaction with compute budget and
 * priority fee already set, so it needs no further assembly.
 */
export async function buildSwapTransaction(params: {
  quote: SwapQuote;
  userPublicKey: string;
}): Promise<BuiltSwap> {
  const res = await fetch(`${SWAP_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      quoteResponse: params.quote,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
      // Let Jupiter size compute units and fees from its own simulation.
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { priorityLevel: "high", maxLamports: 1_000_000 } },
    }),
  });

  if (!res.ok) {
    throw new Error(`Could not build the swap (${res.status})`);
  }

  const json = (await res.json()) as {
    swapTransaction?: string;
    lastValidBlockHeight?: number;
    simulationError?: unknown;
  };

  if (!json.swapTransaction) {
    throw new Error("Jupiter returned no transaction for this route.");
  }

  const simErr = json.simulationError;
  return {
    transactionBase64: json.swapTransaction,
    lastValidBlockHeight: json.lastValidBlockHeight ?? null,
    simulationError:
      simErr == null
        ? null
        : typeof simErr === "string"
          ? simErr
          : ((simErr as { error?: string }).error ??
            JSON.stringify(simErr)),
  };
}
