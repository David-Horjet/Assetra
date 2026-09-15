import { HomeScreen } from "@/components/HomeScreen";
import { getPortfolio } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

/**
 * Home.
 *
 * Until wallet auth is wired, `?wallet=<address>` renders a real mainnet
 * portfolio so the screen can be reviewed against live data rather than
 * fixtures.
 */
export default async function Page({
  searchParams,
}: PageProps<"/">) {
  const params = await searchParams;
  const walletParam = params.wallet;
  const wallet = Array.isArray(walletParam) ? walletParam[0] : walletParam;

  if (!wallet) {
    return <ConnectPrompt />;
  }

  // Only the fetch is guarded — wrapping the JSX would not catch render
  // errors anyway, since React renders after this function returns.
  let snapshot: Awaited<ReturnType<typeof getPortfolio>> | null = null;
  let error: string | null = null;

  try {
    snapshot = await getPortfolio(wallet);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  if (!snapshot) return <LoadError message={error ?? "Unknown error"} />;

  return <HomeScreen snapshot={snapshot} walletAddress={wallet} />;
}

/** Landing state. Replaced by the Privy connect flow in the next phase. */
function ConnectPrompt() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto h-8 w-8 rounded-md"
          style={{ background: "var(--color-signal-mint)" }}
          aria-hidden
        />
        <h1
          className="mt-8"
          style={{
            fontSize: "var(--text-heading)",
            lineHeight: "var(--leading-heading)",
            letterSpacing: "var(--tracking-heading)",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          Turn your stocks into working capital.
        </h1>
        <p className="mt-5 text-ash" style={{ fontSize: "var(--text-body)" }}>
          Borrow against tokenized stocks on Solana — without selling them.
        </p>
        <p
          className="mt-10 text-ash"
          style={{ fontSize: "var(--text-caption)" }}
        >
          Wallet connection lands next. To preview with live data, append
          <span className="numeric"> ?wallet=&lt;address&gt;</span>
        </p>
      </div>
    </main>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div
        className="w-full max-w-md rounded-card border px-6 py-10 text-center"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-carbon)",
        }}
      >
        <div style={{ fontSize: "var(--text-subheading)" }}>
          Couldn&apos;t load this portfolio
        </div>
        <p
          className="mt-3 text-ash"
          style={{ fontSize: "var(--text-caption)" }}
        >
          {message}
        </p>
      </div>
    </main>
  );
}
