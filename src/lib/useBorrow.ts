"use client";

import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { useCallback, useState } from "react";
import type { BorrowVault } from "@/lib/types";

/**
 * Transaction lifecycle.
 *
 * `signing` and `sending` are distinct because they fail for different
 * reasons and need different copy: a rejected signature is the user's
 * choice, a failed send is the network's.
 */
export type BorrowStatus =
  | "idle"
  | "building"
  | "signing"
  | "sending"
  | "confirmed"
  | "error";

export interface BorrowResult {
  signature: string;
  explorerUrl: string;
}

interface BuildResponse {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  error?: string;
  detail?: string;
}

/** Turn a thrown value into copy a user can act on. */
function toMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Privy surfaces user rejection in several shapes depending on the wallet.
  if (/reject|denied|cancel/i.test(raw)) {
    return "Transaction cancelled.";
  }
  if (/insufficient/i.test(raw)) {
    return "Not enough SOL to cover network fees.";
  }
  if (/blockhash|expired/i.test(raw)) {
    return "The transaction expired before it was signed. Please try again.";
  }
  return raw;
}

/**
 * Drives a borrow from preview to confirmed.
 *
 * The transaction is built and simulated server-side, signed by the user's
 * wallet in the browser, then relayed back through the server so submission
 * uses the paid RPC. No private key ever leaves the wallet.
 */
export function useBorrow() {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [status, setStatus] = useState<BorrowStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BorrowResult | null>(null);

  const wallet = wallets[0];

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  const borrow = useCallback(
    async (args: {
      vault: BorrowVault;
      collateralAmount: number;
      borrowAmount: number;
      positionId?: number;
    }) => {
      if (!wallet) {
        setStatus("error");
        setError("Connect a wallet to continue.");
        return;
      }

      setError(null);
      setResult(null);

      try {
        setStatus("building");
        const buildRes = await fetch("/api/borrow/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: wallet.address,
            vaultId: args.vault.id,
            positionId: args.positionId ?? 0,
            collateralAmount: args.collateralAmount,
            borrowAmount: args.borrowAmount,
          }),
        });

        const built = (await buildRes.json()) as BuildResponse;
        if (!buildRes.ok) {
          throw new Error(built.detail || built.error || "Could not prepare the transaction.");
        }

        setStatus("signing");
        const unsigned = Uint8Array.from(
          atob(built.transactionBase64),
          (c) => c.charCodeAt(0),
        );

        const { signedTransaction } = await signTransaction({
          transaction: unsigned,
          wallet,
        });

        setStatus("sending");
        // btoa needs a binary string; chunk to avoid blowing the argument
        // limit on large transactions.
        let binary = "";
        for (let i = 0; i < signedTransaction.length; i += 0x8000) {
          binary += String.fromCharCode(
            ...signedTransaction.subarray(i, i + 0x8000),
          );
        }

        const sendRes = await fetch("/api/borrow/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signedTransaction: btoa(binary),
            blockhash: built.blockhash,
            lastValidBlockHeight: built.lastValidBlockHeight,
          }),
        });

        const sent = (await sendRes.json()) as {
          signature?: string;
          explorerUrl?: string;
          error?: string;
          detail?: string;
        };

        if (!sendRes.ok || !sent.signature) {
          throw new Error(sent.detail || sent.error || "The transaction failed.");
        }

        setResult({
          signature: sent.signature,
          explorerUrl: sent.explorerUrl ?? "",
        });
        setStatus("confirmed");
      } catch (err) {
        setError(toMessage(err));
        setStatus("error");
      }
    },
    [wallet, signTransaction],
  );

  return {
    borrow,
    reset,
    status,
    error,
    result,
    walletAddress: wallet?.address ?? null,
    busy: status === "building" || status === "signing" || status === "sending",
  };
}
