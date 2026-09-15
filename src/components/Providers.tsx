"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

const solanaConnectors = toSolanaWalletConnectors();

/**
 * Privy wallet auth.
 *
 * Solana-only: the product borrows against xStocks, which exist on Solana,
 * so offering EVM chains would be a dead end. External wallets are listed
 * first — a user holding xStocks already has one — with embedded wallets as
 * a fallback so a judge without Phantom can still reach the UI.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Without an app id Privy throws on mount and takes the whole page down.
  // Rendering children unwrapped keeps the read-only ?wallet= preview working.
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#3fe280",
          logo: undefined,
          walletChainType: "solana-only",
          walletList: ["phantom", "solflare", "backpack", "detected_solana_wallets"],
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["wallet", "email"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
