"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { CapitalBar } from "@/components/CapitalBar";
import { HoldingRow } from "@/components/HoldingRow";
import { MarketStatusPill } from "@/components/MarketStatusPill";
import { percent, shortAddress, usd } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/portfolio";
import type { Holding, XStockAsset } from "@/lib/types";

interface HomeScreenProps {
  snapshot: PortfolioSnapshot;
  walletAddress: string;
  refreshing?: boolean;
  /** Viewing an address without a connected wallet — actions are disabled. */
  readOnly?: boolean;
  /** USDC supply APY, for the Earn card. */
  earnApy: number | null;
  /** Total currently supplied to Earn markets. */
  earningUsd: number;
  onBuy: (asset: XStockAsset, price: number | null) => void;
  onBorrow: (holding: Holding) => void;
  onEarn: () => void;
}

/**
 * Home.
 *
 * States what the product does before showing any numbers: a first-time
 * viewer should understand "borrow against stocks without selling" before
 * being asked to interpret a capital split.
 */
export function HomeScreen({
  snapshot,
  walletAddress,
  refreshing = false,
  readOnly = false,
  earnApy,
  earningUsd,
  onBuy,
  onBorrow,
  onEarn,
}: HomeScreenProps) {
  const { capital, holdings, marketStatus, usdcBalance, warning } = snapshot;
  const borrowable = holdings.filter((h) => h.vaults.length > 0);
  const empty = holdings.length === 0;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "var(--page-max-width)" }}>
      <Header
        walletAddress={walletAddress}
        marketStatus={marketStatus}
        refreshing={refreshing}
        readOnly={readOnly}
      />

      <main className="px-6 pb-24 sm:px-10">
        <section className="pt-10 sm:pt-16">
          <div
            className="uppercase text-ash"
            style={{
              fontSize: "var(--text-caption)",
              letterSpacing: "var(--tracking-caption)",
            }}
          >
            Portfolio value
          </div>

          <div
            className="rise numeric-display mt-3"
            style={{
              fontFamily: "var(--font-aeonik)",
              fontSize: "clamp(40px, 8vw, 64px)",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-display)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            <AnimatedNumber value={capital.totalUsd} format={(v) => usd(v)} />
          </div>

          <div
            className="numeric mt-2 text-ash"
            style={{ fontSize: "var(--text-body)" }}
          >
            {usd(usdcBalance)} USDC available
            {earningUsd > 0 && ` · ${usd(earningUsd)} earning`}
          </div>

          {!empty && (
            <div className="mt-9 max-w-xl">
              <CapitalBar
                workingUsd={capital.workingUsd}
                idleUsd={capital.idleUsd}
              />
            </div>
          )}
        </section>

        {/* The three primitives, stated plainly. This is what a first-time
            viewer reads to understand the product. */}
        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          <ActionCard
            label="Buy"
            title="Own tokenized stocks"
            body="Buy NVDAx, SPYx, QQQx or TSLAx with USDC, routed through Jupiter."
            cta={borrowable[0] ? `Buy ${borrowable[0].asset.symbol}` : "Buy stocks"}
            disabled={readOnly}
            onClick={() => {
              const target = borrowable[0] ?? holdings[0];
              if (target) onBuy(target.asset, target.price?.usdPrice ?? null);
              else onBuy(DEFAULT_BUY_ASSET, null);
            }}
          />
          <ActionCard
            label="Borrow"
            title="Unlock cash without selling"
            body="Use your stocks as collateral and borrow USDC against them."
            cta={borrowable[0] ? "Borrow USDC" : "No eligible stocks"}
            accent
            disabled={readOnly || borrowable.length === 0}
            onClick={() => borrowable[0] && onBorrow(borrowable[0])}
          />
          <ActionCard
            label="Earn"
            title="Put your USDC to work"
            body={
              earnApy
                ? `Supply USDC to Jupiter Lend and earn ${percent(earnApy)} APY.`
                : "Supply USDC to Jupiter Lend and earn yield."
            }
            cta={earningUsd > 0 ? "Manage" : "Start earning"}
            disabled={readOnly || !earnApy}
            onClick={onEarn}
          />
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              style={{
                fontFamily: "var(--font-aeonik)",
                fontSize: "var(--text-subheading)",
                letterSpacing: "var(--tracking-subheading)",
              }}
            >
              Your stocks
            </h2>
            {warning && (
              <span
                className="text-ash"
                style={{ fontSize: "var(--text-caption)" }}
                title="Assets without a market price are excluded from valuation rather than counted as zero."
              >
                {warning}
              </span>
            )}
          </div>

          {empty ? (
            <EmptyState
              onBuy={() => onBuy(DEFAULT_BUY_ASSET, null)}
              disabled={readOnly}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              {holdings.map((h, i) => (
                <div key={h.asset.mint}>
                  {/* Mark where actionable assets end, so the rest reads as
                      context rather than as options that failed to work. */}
                  {i === borrowable.length && borrowable.length > 0 && (
                    <div
                      className="px-1 pb-3 pt-8 uppercase text-ash"
                      style={{
                        fontSize: "var(--text-caption)",
                        letterSpacing: "var(--tracking-caption)",
                      }}
                    >
                      No lending market yet
                    </div>
                  )}
                  <HoldingRow holding={h} index={i} onSelect={onBorrow} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * Buy target for a wallet holding nothing yet.
 *
 * SPYx has the highest LTV of the four vault assets (75%), so it gives a new
 * user the most borrowing power per dollar.
 */
const DEFAULT_BUY_ASSET: XStockAsset = {
  symbol: "SPYx",
  name: "S&P 500 xStock",
  underlyingSymbol: "SPY",
  mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  logo: "https://xstocks-metadata.backed.fi/logos/tokens/SPYx.png",
  isTradingHalted: false,
};

function ActionCard({
  label,
  title,
  body,
  cta,
  onClick,
  accent,
  disabled,
}: {
  label: string;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      transition={{ duration: 0.2 }}
      className="rise flex flex-col rounded-card border px-5 py-5 text-left transition-colors disabled:opacity-45"
      style={{
        borderColor: accent
          ? "rgba(63, 226, 128, 0.25)"
          : "var(--border-subtle)",
        background: "var(--surface-carbon)",
      }}
    >
      <span
        className="uppercase"
        style={{
          color: accent ? "var(--color-signal-mint)" : "var(--color-ash)",
          fontSize: "var(--text-caption)",
          letterSpacing: "var(--tracking-caption)",
        }}
      >
        {label}
      </span>
      <span
        className="mt-2"
        style={{
          fontFamily: "var(--font-aeonik)",
          fontSize: "var(--text-body)",
        }}
      >
        {title}
      </span>
      <span
        className="mt-1.5 flex-1 text-ash"
        style={{ fontSize: "var(--text-caption)" }}
      >
        {body}
      </span>
      <span
        className="mt-4 inline-flex items-center gap-1.5"
        style={{
          color: accent ? "var(--color-signal-mint)" : "var(--color-chalk)",
          fontSize: "var(--text-caption)",
        }}
      >
        {cta}
        <span aria-hidden>→</span>
      </span>
    </motion.button>
  );
}

function Header({
  walletAddress,
  marketStatus,
  refreshing,
  readOnly,
}: {
  walletAddress: string;
  marketStatus: HomeScreenProps["snapshot"]["marketStatus"];
  refreshing: boolean;
  readOnly: boolean;
}) {
  const { logout, authenticated } = usePrivy();

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-10">
      <div className="flex shrink-0 items-center gap-3">
        <div
          className="h-6 w-6 rounded-md"
          style={{ background: "var(--color-signal-mint)" }}
          aria-hidden
        />
        <span
          style={{
            fontFamily: "var(--font-aeonik)",
            fontSize: "var(--text-body)",
            letterSpacing: "var(--tracking-body)",
          }}
        >
          Assetra
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden sm:block">
          <MarketStatusPill status={marketStatus} />
        </div>
        {readOnly && (
          <span
            className="hidden shrink-0 rounded-pill px-2.5 py-1 text-ash sm:inline"
            style={{
              background: "var(--surface-graphite)",
              fontSize: "var(--text-caption)",
            }}
            title="Viewing a wallet you have not connected. Actions are unavailable."
          >
            Read only
          </span>
        )}
        <button
          type="button"
          onClick={authenticated ? logout : undefined}
          disabled={!authenticated}
          title={authenticated ? "Disconnect" : undefined}
          className="numeric shrink-0 rounded-pill border px-3 py-1.5 text-ash transition-colors enabled:hover:text-chalk"
          style={{
            borderColor: "var(--border-subtle)",
            fontSize: "var(--text-caption)",
            opacity: refreshing ? 0.55 : 1,
          }}
        >
          {shortAddress(walletAddress)}
        </button>
      </div>
    </header>
  );
}

function EmptyState({
  onBuy,
  disabled,
}: {
  onBuy: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="mt-6 rounded-card border px-6 py-14 text-center"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--surface-carbon)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-aeonik)",
          fontSize: "var(--text-subheading)",
        }}
      >
        Start with your first stock
      </div>
      <p
        className="mx-auto mt-3 max-w-sm text-ash"
        style={{ fontSize: "var(--text-body)" }}
      >
        Buy a tokenized stock with USDC, then borrow against it without selling.
      </p>
      <button
        type="button"
        onClick={onBuy}
        disabled={disabled}
        className="mt-7 px-7 py-3.5 text-abyss disabled:opacity-40"
        style={{
          borderRadius: "var(--radius-herobutton)",
          background: "var(--color-signal-mint)",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-weight-medium)",
        }}
      >
        Buy SPYx
      </button>
    </div>
  );
}
