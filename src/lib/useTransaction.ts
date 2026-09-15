"use client";

import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { useCallback, useState } from "react";

/**
 * Transaction lifecycle.
 *
 * `signing` and `sending` are separate because they fail for different
 * reasons and need different copy: a rejected signature is the user's
 * choice, a failed send is the network's.
 */
export type TxStatus =
  | "idle"
  | "building"
  | "signing"
  | "sending"
  | "confirmed"
  | "error";

export interface TxResult {
  signature: string;
  explorerUrl: string;
}

/** Base64 → bytes, for a transaction handed to the wallet. */
function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

/** Bytes → base64, chunked to stay inside the argument limit. */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Turn a thrown value into copy a user can act on. */
function toMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/reject|denied|cancel|user declined/i.test(raw)) {
    return "Transaction cancelled.";
  }
  if (/insufficient lamports|insufficient funds for fee/i.test(raw)) {
    return "Not enough SOL to cover network fees.";
  }
  if (/insufficient/i.test(raw)) {
    return "Insufficient balance for this transaction.";
  }
  if (/blockhash|expired|block height exceeded/i.test(raw)) {
    return "The transaction expired before it was confirmed. Please try again.";
  }
  if (/slippage/i.test(raw)) {
    return "Price moved beyond the slippage limit. Try again for a fresh quote.";
  }
  return raw;
}

export interface BuildStep {
  /** Endpoint that returns an unsigned transaction. */
  url: string;
  body: Record<string, unknown>;
  /** Field holding the base64 transaction; endpoints differ. */
  transactionField?: string;
}

/**
 * Drives any transaction from build to confirmation.
 *
 * Shared by buy, borrow, repay and earn: each supplies its own build
 * endpoint, and the sign-submit-confirm half is identical. The wallet signs
 * in the browser; no private key ever reaches the server.
 */
export function useTransaction() {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TxResult | null>(null);

  const wallet = wallets[0];

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  const run = useCallback(
    async (step: BuildStep): Promise<TxResult | null> => {
      if (!wallet) {
        setStatus("error");
        setError("Connect a wallet to continue.");
        return null;
      }

      setError(null);
      setResult(null);

      try {
        setStatus("building");
        const buildRes = await fetch(step.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: wallet.address, ...step.body }),
        });

        const built = (await buildRes.json()) as Record<string, unknown>;
        if (!buildRes.ok) {
          throw new Error(
            (built.detail as string) ||
              (built.error as string) ||
              "Could not prepare the transaction.",
          );
        }

        const field = step.transactionField ?? "transactionBase64";
        const unsignedB64 = built[field] as string | undefined;
        if (!unsignedB64) throw new Error("No transaction was returned.");

        setStatus("signing");
        const { signedTransaction } = await signTransaction({
          transaction: decodeBase64(unsignedB64),
          wallet,
        });

        setStatus("sending");
        const sendRes = await fetch("/api/tx/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signedTransaction: encodeBase64(signedTransaction),
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
          throw new Error(
            sent.detail || sent.error || "The transaction failed.",
          );
        }

        const done: TxResult = {
          signature: sent.signature,
          explorerUrl: sent.explorerUrl ?? "",
        };
        setResult(done);
        setStatus("confirmed");
        return done;
      } catch (err) {
        setError(toMessage(err));
        setStatus("error");
        return null;
      }
    },
    [wallet, signTransaction],
  );

  return {
    run,
    reset,
    status,
    error,
    result,
    walletAddress: wallet?.address ?? null,
    busy: status === "building" || status === "signing" || status === "sending",
  };
}
