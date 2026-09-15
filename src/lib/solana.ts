import { Connection } from "@solana/web3.js";

/**
 * Server-side Solana connection.
 *
 * The RPC URL carries an API key, so it is read from a non-public env var and
 * this module must only be imported from server code (route handlers, server
 * components). Importing it into a client component would leak the key.
 */
let cached: Connection | null = null;

export function getConnection(): Connection {
  if (cached) return cached;

  const url = process.env.SOLANA_RPC_URL;
  if (!url) {
    throw new Error(
      "SOLANA_RPC_URL is not set. Copy .env.example to .env.local and add a Helius (or equivalent) RPC URL.",
    );
  }

  cached = new Connection(url, "confirmed");
  return cached;
}

/** Explorer link for a confirmed signature. */
export function explorerTx(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

/** Explorer link for an account. */
export function explorerAccount(address: string): string {
  return `https://solscan.io/account/${address}`;
}
