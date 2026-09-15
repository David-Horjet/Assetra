"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BorrowSheet } from "@/components/BorrowSheet";
import { HomeScreen } from "@/components/HomeScreen";
import { Landing } from "@/components/Landing";
import { TransactionState } from "@/components/TransactionState";
import { useBorrow } from "@/lib/useBorrow";
import type { PortfolioSnapshot } from "@/lib/portfolio";
import type { Holding } from "@/lib/types";

/**
 * Connected-app shell.
 *
 * Owns the borrow flow so the sheet, the transaction states and the
 * portfolio refresh all react to one source of truth.
 */
export function AppShell({
  initialSnapshot,
  initialWallet,
}: {
  /** Server-rendered portfolio for the ?wallet= preview, if present. */
  initialSnapshot: PortfolioSnapshot | null;
  initialWallet: string | null;
}) {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const connected = wallets[0]?.address ?? null;
  // The preview address keeps working when nothing is connected, so the app
  // is reviewable without a wallet.
  const address = connected ?? initialWallet;

  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(
    initialSnapshot,
  );
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<Holding | null>(null);
  const [lastAmount, setLastAmount] = useState(0);

  const borrow = useBorrow();

  const load = useCallback(async (wallet: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/portfolio?wallet=${encodeURIComponent(wallet)}`,
      );
      if (res.ok) setSnapshot((await res.json()) as PortfolioSnapshot);
    } finally {
      setLoading(false);
    }
  }, []);

  // Track the address already fetched in a ref: it is bookkeeping, not
  // render state, so writing it must not schedule a render.
  const loadedFor = useRef<string | null>(
    initialSnapshot ? initialWallet : null,
  );

  useEffect(() => {
    if (!connected || connected === loadedFor.current) return;
    loadedFor.current = connected;
    void load(connected);
  }, [connected, load]);

  const handleDone = useCallback(() => {
    borrow.reset();
    setActive(null);
    // The position has changed on-chain; re-read rather than guessing.
    if (address) void load(address);
  }, [borrow, address, load]);

  if (!ready) return <Splash />;

  if (!address && !authenticated) return <Landing />;

  if (!snapshot) return <Splash />;

  return (
    <>
      <HomeScreen
        snapshot={snapshot}
        walletAddress={address ?? ""}
        onSelectHolding={setActive}
        refreshing={loading}
        readOnly={!connected}
      />

      <AnimatePresence>
        {active && borrow.status === "idle" && (
          <BorrowSheet
            holding={active}
            onClose={() => setActive(null)}
            busy={borrow.busy}
            error={borrow.error}
            onConfirm={({ vault, collateralAmount, borrowAmount }) => {
              setLastAmount(borrowAmount);
              void borrow.borrow({ vault, collateralAmount, borrowAmount });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {borrow.status !== "idle" && (
          <TransactionState
            status={borrow.status}
            error={borrow.error}
            result={borrow.result}
            borrowAmount={lastAmount}
            borrowSymbol={
              active?.vaults.find((v) => v.borrowSymbol === "USDC")
                ?.borrowSymbol ?? "USDC"
            }
            collateralSymbol={active?.asset.symbol ?? ""}
            onDone={handleDone}
            onRetry={borrow.reset}
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
