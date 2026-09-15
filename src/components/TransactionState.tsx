"use client";

import { motion } from "motion/react";
import { usd } from "@/lib/format";
import type { BorrowResult, BorrowStatus } from "@/lib/useBorrow";

interface TransactionStateProps {
  status: BorrowStatus;
  error: string | null;
  result: BorrowResult | null;
  borrowAmount: number;
  borrowSymbol: string;
  collateralSymbol: string;
  onDone: () => void;
  onRetry: () => void;
}

const STEP_COPY: Record<string, { title: string; detail: string }> = {
  building: {
    title: "Preparing transaction",
    detail: "Checking vault liquidity and simulating on-chain.",
  },
  signing: {
    title: "Confirm in your wallet",
    detail: "Review the transaction and approve it to continue.",
  },
  sending: {
    title: "Submitting to Solana",
    detail: "Waiting for network confirmation.",
  },
};

/**
 * Transaction feedback.
 *
 * Success is only ever shown after on-chain confirmation — the pending state
 * runs until the RPC confirms, so a user never sees a balance that does not
 * yet exist.
 */
export function TransactionState({
  status,
  error,
  result,
  borrowAmount,
  borrowSymbol,
  collateralSymbol,
  onDone,
  onRetry,
}: TransactionStateProps) {
  if (status === "idle") return null;

  const pending = STEP_COPY[status];

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <motion.div
        role="status"
        aria-live="polite"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl border px-7 py-9 text-center"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-carbon)",
        }}
      >
        {pending && <Pending {...pending} />}

        {status === "confirmed" && result && (
          <Confirmed
            borrowAmount={borrowAmount}
            borrowSymbol={borrowSymbol}
            collateralSymbol={collateralSymbol}
            result={result}
            onDone={onDone}
          />
        )}

        {status === "error" && (
          <Failed error={error} onRetry={onRetry} onDone={onDone} />
        )}
      </motion.div>
    </motion.div>
  );
}

function Pending({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <div className="mx-auto flex h-12 w-12 items-center justify-center">
        <motion.span
          className="block h-8 w-8 rounded-full border-2"
          style={{
            borderColor: "var(--border-strong)",
            borderTopColor: "var(--color-signal-mint)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <div
        className="mt-6"
        style={{
          fontFamily: "var(--font-aeonik)",
          fontSize: "var(--text-subheading)",
        }}
      >
        {title}
      </div>
      <p className="mt-2 text-ash" style={{ fontSize: "var(--text-caption)" }}>
        {detail}
      </p>
    </>
  );
}

function Confirmed({
  borrowAmount,
  borrowSymbol,
  collateralSymbol,
  result,
  onDone,
}: {
  borrowAmount: number;
  borrowSymbol: string;
  collateralSymbol: string;
  result: BorrowResult;
  onDone: () => void;
}) {
  return (
    <>
      <motion.div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "rgba(63, 226, 128, 0.12)" }}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <span style={{ color: "var(--color-signal-mint)", fontSize: 22 }}>✓</span>
      </motion.div>

      <div
        className="numeric-display mt-6"
        style={{
          fontFamily: "var(--font-aeonik)",
          fontSize: "var(--text-heading)",
          lineHeight: 1.1,
        }}
      >
        {usd(borrowAmount)}
      </div>
      <div style={{ fontSize: "var(--text-body)" }}>
        {borrowSymbol} unlocked
      </div>

      {/* The whole point of the product, stated at the moment it lands. */}
      <p className="mt-3 text-ash" style={{ fontSize: "var(--text-caption)" }}>
        Your {collateralSymbol} is still yours.
      </p>

      {result.explorerUrl && (
        <a
          href={result.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-ash underline transition-colors hover:text-chalk"
          style={{ fontSize: "var(--text-caption)" }}
        >
          View transaction
        </a>
      )}

      <button
        type="button"
        onClick={onDone}
        className="mt-7 w-full py-3.5 text-abyss"
        style={{
          borderRadius: "var(--radius-herobutton)",
          background: "var(--color-signal-mint)",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-weight-medium)",
        }}
      >
        Done
      </button>
    </>
  );
}

function Failed({
  error,
  onRetry,
  onDone,
}: {
  error: string | null;
  onRetry: () => void;
  onDone: () => void;
}) {
  const cancelled = error === "Transaction cancelled.";

  return (
    <>
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "rgba(226, 92, 92, 0.12)" }}
      >
        <span style={{ color: "#e2917c", fontSize: 22 }}>{cancelled ? "–" : "!"}</span>
      </div>
      <div
        className="mt-6"
        style={{
          fontFamily: "var(--font-aeonik)",
          fontSize: "var(--text-subheading)",
        }}
      >
        {cancelled ? "Transaction cancelled" : "Something went wrong"}
      </div>
      <p
        className="mt-2 break-words text-ash"
        style={{ fontSize: "var(--text-caption)" }}
      >
        {cancelled
          ? "Nothing was submitted and no funds moved."
          : (error ?? "The transaction could not be completed.")}
      </p>

      <div className="mt-7 flex gap-3">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 border py-3.5"
          style={{
            borderRadius: "var(--radius-herobutton)",
            borderColor: "var(--border-strong)",
            fontSize: "var(--text-body)",
          }}
        >
          Close
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 py-3.5 text-abyss"
          style={{
            borderRadius: "var(--radius-herobutton)",
            background: "var(--color-signal-mint)",
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          Try again
        </button>
      </div>
    </>
  );
}
