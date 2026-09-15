import { AppShell } from "@/components/AppShell";
import { getPortfolio } from "@/lib/portfolio";
import type { PortfolioSnapshot } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

/**
 * Home.
 *
 * `?wallet=<address>` server-renders a real portfolio for review without a
 * wallet; otherwise the shell shows the connect flow and loads the
 * portfolio once a wallet is connected.
 */
export default async function Page({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const raw = params.wallet;
  const wallet = Array.isArray(raw) ? raw[0] : (raw ?? null);

  let snapshot: PortfolioSnapshot | null = null;
  if (wallet) {
    try {
      snapshot = await getPortfolio(wallet);
    } catch {
      // A bad preview address should not block the connect flow.
      snapshot = null;
    }
  }

  return <AppShell initialSnapshot={snapshot} initialWallet={wallet} />;
}
