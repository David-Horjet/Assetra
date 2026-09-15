"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Sheet, SheetRow } from "@/components/Sheet";
import { percent, usd } from "@/lib/format";
import type { EarnMarket, EarnPosition } from "@/lib/jupiter/earn";

interface EarnSheetProps {
  market: EarnMarket;
  /** Wallet balance of the underlying asset, UI units. */
  available: number;
  position: EarnPosition | null;
  onClose: () => void;
  onConfirm: (args: {
    action: "deposit" | "withdraw";
    assetMint: string;
    amount: number;
  }) => void;
  busy?: boolean;
  error?: string | null;
}

/**
 * Supply to or withdraw from a Jupiter Earn market.
 *
 * Every Earn market is a stablecoin — there is no xStock market — so this is
 * where borrowed USDC goes to work, completing the buy → borrow → earn loop.
 */
export function EarnSheet({
  market,
  available,
  position,
  onClose,
  onConfirm,
  busy = false,
  error = null,
}: EarnSheetProps) {
  const [action, setAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState(0);

  const supplied = position?.uiAmount ?? 0;
  const max = action === "deposit" ? available : supplied;
  const insufficient = amount > max;
  const canSubmit = amount > 0 && !insufficient && !busy;

  // Simple projection: Jupiter's rate is already an APY.
  const yearly = amount * market.supplyApy;

  return (
    <Sheet
      title={`Earn on ${market.assetSymbol}`}
      subtitle={`${percent(market.supplyApy)} APY · Jupiter Lend`}
      logo={market.assetLogo}
      onClose={onClose}
    >
      {supplied > 0 && (
        <div
          className="mb-6 flex items-center justify-between rounded-card px-4 py-3"
          style={{ background: "rgba(63, 226, 128, 0.08)" }}
        >
          <span className="text-ash" style={{ fontSize: "var(--text-caption)" }}>
            Currently earning
          </span>
          <span
            className="numeric"
            style={{
              color: "var(--color-signal-mint)",
              fontSize: "var(--text-caption)",
            }}
          >
            {usd(position?.usdValue ?? 0)}
          </span>
        </div>
      )}

      {supplied > 0 && (
        <div
          className="mb-6 flex gap-1 rounded-pill p-1"
          style={{ background: "var(--surface-abyss)" }}
        >
          {(["deposit", "withdraw"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAction(a);
                setAmount(0);
              }}
              className="flex-1 rounded-pill py-2 transition-colors"
              style={{
                background:
                  action === a ? "var(--surface-graphite)" : "transparent",
                color:
                  action === a ? "var(--color-chalk)" : "var(--color-ash)",
                fontSize: "var(--text-caption)",
              }}
            >
              {a === "deposit" ? "Supply" : "Withdraw"}
            </button>
          ))}
        </div>
      )}

      <div
        className="uppercase text-ash"
        style={{
          fontSize: "var(--text-caption)",
          letterSpacing: "var(--tracking-caption)",
        }}
      >
        {action === "deposit" ? "Supply" : "Withdraw"}
      </div>

      <div
        className="mt-2 flex items-center gap-3 rounded-card border px-4 py-3.5"
        style={{
          borderColor: insufficient
            ? "rgba(226,92,92,0.4)"
            : "var(--border-subtle)",
          background: "var(--surface-abyss)",
        }}
      >
        <span className="text-ash" style={{ fontSize: "var(--text-subheading)" }}>
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={amount || ""}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          disabled={busy}
          aria-label={`Amount of ${market.assetSymbol}`}
          className="numeric-display w-full bg-transparent outline-none"
          style={{ fontSize: "var(--text-heading-sm)" }}
        />
        <button
          type="button"
          onClick={() => setAmount(Math.floor(max * 100) / 100)}
          disabled={busy || max <= 0}
          className="shrink-0 rounded-pill px-2.5 py-1 text-ash transition-colors hover:text-chalk disabled:opacity-40"
          style={{
            background: "var(--surface-graphite)",
            fontSize: "var(--text-caption)",
          }}
        >
          Max
        </button>
      </div>

      <div
        className="mt-2 text-ash"
        style={{ fontSize: "var(--text-caption)" }}
      >
        {action === "deposit"
          ? `${usd(available)} available`
          : `${usd(supplied)} supplied`}
      </div>

      <div
        className="mt-7 rounded-card border"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-abyss)",
        }}
      >
        <SheetRow label="Current APY">
          <span className="numeric" style={{ color: "var(--color-signal-mint)" }}>
            {percent(market.supplyApy)}
          </span>
        </SheetRow>
        <SheetRow label="Est. yearly">
          <span className="numeric">{usd(yearly)}</span>
        </SheetRow>
        <SheetRow label="Withdrawals" last>
          <span className="text-ash">Anytime, no lock-up</span>
        </SheetRow>
      </div>

      <AnimatePresence>
        {(error || insufficient) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden rounded-card px-4 py-3"
            style={{
              background: "rgba(226, 92, 92, 0.1)",
              color: "#e2917c",
              fontSize: "var(--text-caption)",
            }}
          >
            {insufficient
              ? `Only ${usd(max)} available.`
              : error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.01 } : undefined}
        whileTap={canSubmit ? { scale: 0.99 } : undefined}
        onClick={() =>
          onConfirm({ action, assetMint: market.assetMint, amount })
        }
        className="mt-6 w-full py-4 text-abyss transition-opacity disabled:opacity-35"
        style={{
          borderRadius: "var(--radius-herobutton)",
          background: "var(--color-signal-mint)",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-weight-medium)",
        }}
      >
        {busy
          ? "Preparing…"
          : action === "deposit"
            ? `Supply ${market.assetSymbol}`
            : `Withdraw ${market.assetSymbol}`}
      </motion.button>

      <p
        className="mt-3 text-center text-ash"
        style={{ fontSize: "var(--text-caption)" }}
      >
        Rates are variable and set by market demand.
      </p>
    </Sheet>
  );
}
