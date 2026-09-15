"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BorrowSheet } from "@/components/BorrowSheet";
import { BuySheet } from "@/components/BuySheet";
import { EarnSheet } from "@/components/EarnSheet";
import { HomeScreen } from "@/components/HomeScreen";
import { Landing } from "@/components/Landing";
import { TransactionState } from "@/components/TransactionState";
import { tokenAmount, usd } from "@/lib/format";
import { useTransaction } from "@/lib/useTransaction";
import type { EarnMarket, EarnPosition } from "@/lib/jupiter/earn";
import type { QuoteSummary } from "@/lib/jupiter/swap";
import type { PortfolioSnapshot } from "@/lib/portfolio";
import type { Holding, XStockAsset } from "@/lib/types";

/** Which sheet is open, and what it is acting on. */
type Sheet =
  | { kind: "buy"; asset: XStockAsset; price: number | null }
  | { kind: "borrow"; holding: Holding }
  | { kind: "earn"; market: EarnMarket }
  | null;

/** Copy for the confirmation screen, set when a flow starts. */
interface Outcome {
  headline: string;
  caption: string;
  note?: string;
}

export function AppShell({
  initialSnapshot,
  initialWallet,
}: {
  initialSnapshot: PortfolioSnapshot | null;
  initialWallet: string | null;
}) {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const connected = wallets[0]?.address ?? null;
  // The ?wallet= preview keeps working unconnected, so the app is reviewable
  // without a wallet.
  const address = connected ?? initialWallet;

  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(
    initialSnapshot,
  );
  const [earn, setEarn] = useState<{
    markets: EarnMarket[];
    positions: EarnPosition[];
  }>({ markets: [], positions: [] });
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const tx = useTransaction();

  const load = useCallback(async (wallet: string) => {
    setLoading(true);
    try {
      const [pf, ea] = await Promise.all([
        fetch(`/api/portfolio?wallet=${encodeURIComponent(wallet)}`),
        fetch(`/api/earn/markets?wallet=${encodeURIComponent(wallet)}`),
      ]);
      if (pf.ok) setSnapshot((await pf.json()) as PortfolioSnapshot);
      if (ea.ok) setEarn(await ea.json());
    } finally {
      setLoading(false);
    }
  }, []);

  // Bookkeeping, not render state — a ref so writing it schedules no render.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!address || address === loadedFor.current) return;
    loadedFor.current = address;
    void load(address);
  }, [address, load]);

  const close = useCallback(() => {
    tx.reset();
    setSheet(null);
    setOutcome(null);
    // Balances have changed on-chain; re-read rather than guessing.
    if (address) void load(address);
  }, [tx, address, load]);

  if (!ready) return <Splash />;
  if (!address && !authenticated) return <Landing />;
  if (!snapshot) return <Splash />;

  const usdcMarket = earn.markets.find((m) => m.assetSymbol === "USDC");
  const usdcPosition =
    earn.positions.find((p) => p.market.assetSymbol === "USDC") ?? null;
  const earningUsd = earn.positions.reduce((s, p) => s + p.usdValue, 0);

  return (
    <>
      <HomeScreen
        snapshot={snapshot}
        walletAddress={address ?? ""}
        refreshing={loading}
        readOnly={!connected}
        earnApy={usdcMarket?.supplyApy ?? null}
        earningUsd={earningUsd}
        onBuy={(asset, price) => setSheet({ kind: "buy", asset, price })}
        onBorrow={(holding) => setSheet({ kind: "borrow", holding })}
        onEarn={() =>
          usdcMarket && setSheet({ kind: "earn", market: usdcMarket })
        }
      />

      <AnimatePresence>
        {sheet?.kind === "buy" && tx.status === "idle" && (
          <BuySheet
            asset={sheet.asset}
            price={sheet.price}
            usdcBalance={snapshot.usdcBalance}
            busy={tx.busy}
            error={tx.error}
            onClose={() => setSheet(null)}
            onConfirm={(quote: QuoteSummary) => {
              setOutcome({
                headline: `${tokenAmount(quote.outUiAmount, 6)} ${sheet.asset.symbol}`,
                caption: "added to your portfolio",
                note: "You can now borrow against it without selling.",
              });
              void tx.run({
                url: "/api/swap/build",
                body: { quote: quote.quote },
              });
            }}
          />
        )}

        {sheet?.kind === "borrow" && tx.status === "idle" && (
          <BorrowSheet
            holding={sheet.holding}
            busy={tx.busy}
            error={tx.error}
            onClose={() => setSheet(null)}
            onConfirm={({ vault, collateralAmount, borrowAmount }) => {
              setOutcome({
                headline: usd(borrowAmount),
                caption: `${vault.borrowSymbol} unlocked`,
                note: `Your ${sheet.holding.asset.symbol} is still yours.`,
              });
              void tx.run({
                url: "/api/borrow/build",
                body: {
                  vaultId: vault.id,
                  positionId: 0,
                  collateralAmount,
                  borrowAmount,
                },
              });
            }}
          />
        )}

        {sheet?.kind === "earn" && tx.status === "idle" && (
          <EarnSheet
            market={sheet.market}
            available={snapshot.usdcBalance}
            position={usdcPosition}
            busy={tx.busy}
            error={tx.error}
            onClose={() => setSheet(null)}
            onConfirm={({ action, assetMint, amount }) => {
              setOutcome({
                headline: usd(amount),
                caption:
                  action === "deposit"
                    ? `${sheet.market.assetSymbol} now earning`
                    : `${sheet.market.assetSymbol} withdrawn`,
                note:
                  action === "deposit"
                    ? "Withdraw anytime — there is no lock-up."
                    : undefined,
              });
              void tx.run({
                url: "/api/earn/build",
                body: { action, assetMint, amount },
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tx.status !== "idle" && (
          <TransactionState
            status={tx.status}
            error={tx.error}
            result={tx.result}
            headline={outcome?.headline ?? ""}
            caption={outcome?.caption ?? ""}
            note={outcome?.note}
            onDone={close}
            onRetry={tx.reset}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Splash() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <div
        className="h-8 w-8 animate-pulse rounded-md"
        style={{ background: "var(--surface-graphite)" }}
        aria-label="Loading"
      />
    </main>
  );
}
